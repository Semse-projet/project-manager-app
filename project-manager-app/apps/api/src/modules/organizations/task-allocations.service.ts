import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { hasPermission } from "../../common/rbac.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

/**
 * BO-10 — asignación de tareas canónicas (JobTask) a personas de una cuadrilla.
 * Spec: docs/specs/core/task-allocations.spec.md
 *
 * Una tarea compartida es UNA JobTask con varias asignaciones (índice único
 * tarea+persona), nunca tareas duplicadas. El supervisor solo asigna dentro de
 * su cuadrilla, con la membresía revalidada en cada llamada. Ejecutar una tarea
 * es independiente del reloj: aquí no se toca el tiempo laboral ni el pago.
 */
const CREWS_MANAGE = "org:crews:manage";

export type AllocationStatus = "ASSIGNED" | "ACKNOWLEDGED" | "IN_PROGRESS" | "BLOCKED" | "SUBMITTED" | "RELEASED";
export type WorkerStatus = "ACKNOWLEDGED" | "IN_PROGRESS" | "BLOCKED" | "SUBMITTED";

export type AllocationActor = { tenantId: string; userId: string; roles: string[] };

export function isTaskAllocationEnabled(): boolean {
  return process.env.SEMSE_TASK_ALLOCATION_ENABLED === "true";
}

/** Transiciones válidas que puede pedir el trabajador sobre su propia asignación. */
const TRANSITIONS: Record<string, WorkerStatus[]> = {
  ASSIGNED: ["ACKNOWLEDGED", "IN_PROGRESS", "BLOCKED"],
  ACKNOWLEDGED: ["IN_PROGRESS", "BLOCKED"],
  IN_PROGRESS: ["BLOCKED", "SUBMITTED"],
  BLOCKED: ["IN_PROGRESS"],
  SUBMITTED: [],
  RELEASED: []
};

type AllocationRow = {
  id: string;
  orgId: string;
  taskId: string;
  crewId: string;
  userId: string;
  status: string;
  assignReason: string | null;
  statusNote: string | null;
  assignedAt: Date;
  acknowledgedAt: Date | null;
  releasedAt: Date | null;
  releaseReason: string | null;
};

@Injectable()
export class TaskAllocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private assertEnabled(): void {
    if (!isTaskAllocationEnabled()) {
      throw new NotFoundException();
    }
  }

  /** Cuadrilla activa a la que el actor puede asignar: su supervisor vigente o un gestor de cuadrillas de la Org. */
  private async requireCrewScope(actor: AllocationActor, crewId: string) {
    const crew = await this.prisma.crew.findFirst({ where: { id: crewId, tenantId: actor.tenantId, status: "ACTIVE" } });
    if (!crew) throw new NotFoundException();
    const live = await this.prisma.membership.findMany({
      where: { userId: actor.userId, orgId: crew.orgId, status: "ACTIVE", org: { tenantId: actor.tenantId } },
      include: { role: true }
    });
    if (live.length === 0) throw new NotFoundException();
    const isSupervisor = crew.supervisorUserId === actor.userId;
    const isManager = hasPermission(live.map((m) => m.role.key), CREWS_MANAGE);
    if (!isSupervisor && !isManager) throw new ForbiddenException();
    return crew;
  }

  private async record(
    tenantId: string,
    orgId: string,
    actorUserId: string,
    action: string,
    entityId: string,
    requestId: string,
    afterJson: Record<string, unknown>
  ): Promise<void> {
    await this.audit.append({
      tenantId,
      orgId,
      actorUserId,
      action,
      entityType: "TaskAllocation",
      entityId,
      requestId,
      timestamp: new Date().toISOString(),
      afterJson
    });
  }

  async assign(actor: AllocationActor, crewId: string, taskId: string, requestId: string, userIds: string[], reason?: string) {
    this.assertEnabled();
    const crew = await this.requireCrewScope(actor, crewId);
    const task = await this.prisma.jobTask.findFirst({ where: { id: taskId, tenantId: actor.tenantId, orgId: crew.orgId } });
    if (!task || task.status === "done" || task.status === "canceled") {
      throw new UnprocessableEntityException("La tarea no existe en esta organización o ya está cerrada");
    }
    const unique = [...new Set(userIds)];
    const members = await this.prisma.crewMember.findMany({ where: { crewId: crew.id, status: "ACTIVE" } });
    const memberIds = new Set(members.map((m) => m.userId));
    if (unique.some((id) => !memberIds.has(id))) {
      throw new UnprocessableEntityException("Solo se asigna a miembros activos de la cuadrilla");
    }
    const result: AllocationRow[] = [];
    for (const userId of unique) {
      const existing = await this.prisma.taskAllocation.findFirst({ where: { taskId, userId } });
      let row: AllocationRow;
      if (!existing) {
        row = await this.prisma.taskAllocation.create({
          data: {
            tenantId: actor.tenantId,
            orgId: crew.orgId,
            taskId,
            crewId: crew.id,
            userId,
            assignedByUserId: actor.userId,
            assignReason: reason ?? null
          }
        });
      } else if (existing.status === "RELEASED") {
        const reopened = await this.prisma.taskAllocation.updateMany({
          where: { id: existing.id, status: "RELEASED" },
          data: {
            status: "ASSIGNED",
            crewId: crew.id,
            assignedByUserId: actor.userId,
            assignReason: reason ?? null,
            assignedAt: new Date(),
            acknowledgedAt: null,
            releasedAt: null,
            releasedByUserId: null,
            releaseReason: null,
            statusNote: null
          }
        });
        if (reopened.count !== 1) throw new ConflictException("La asignación cambió; vuelve a intentar");
        row = { ...existing, status: "ASSIGNED", crewId: crew.id, assignReason: reason ?? null, releasedAt: null, releaseReason: null, acknowledgedAt: null, statusNote: null, assignedAt: new Date() };
      } else {
        // Ya asignada y vigente: idempotente, no se duplica.
        row = existing;
        result.push(row);
        continue;
      }
      await this.record(actor.tenantId, crew.orgId, actor.userId, "task_allocation.assigned", row.id, requestId, { taskId, crewId: crew.id, userId });
      result.push(row);
    }
    return result.map((row) => this.view(row));
  }

  async release(actor: AllocationActor, crewId: string, taskId: string, userId: string, requestId: string, reason: string) {
    this.assertEnabled();
    const crew = await this.requireCrewScope(actor, crewId);
    const existing = await this.prisma.taskAllocation.findFirst({ where: { taskId, userId, crewId: crew.id } });
    if (!existing) throw new NotFoundException();
    if (existing.status === "RELEASED") throw new ConflictException("La asignación ya fue liberada");
    const claimed = await this.prisma.taskAllocation.updateMany({
      where: { id: existing.id, status: existing.status },
      data: { status: "RELEASED", releasedAt: new Date(), releasedByUserId: actor.userId, releaseReason: reason }
    });
    if (claimed.count !== 1) throw new ConflictException("La asignación cambió; vuelve a intentar");
    await this.record(actor.tenantId, crew.orgId, actor.userId, "task_allocation.released", existing.id, requestId, { taskId, userId });
    return { status: "RELEASED" as const };
  }

  async listForTask(actor: AllocationActor, crewId: string, taskId: string) {
    this.assertEnabled();
    const crew = await this.requireCrewScope(actor, crewId);
    const rows = await this.prisma.taskAllocation.findMany({ where: { taskId, crewId: crew.id } });
    const titles = await this.titles(actor.tenantId, rows.map((r) => r.taskId));
    return rows.map((row) => this.view(row, titles.get(row.taskId)));
  }

  async listMine(user: { tenantId: string; userId: string }) {
    this.assertEnabled();
    const rows = await this.prisma.taskAllocation.findMany({ where: { tenantId: user.tenantId, userId: user.userId } });
    const live = rows.filter((row) => row.status !== "RELEASED");
    const titles = await this.titles(user.tenantId, live.map((r) => r.taskId));
    return live.map((row) => this.view(row, titles.get(row.taskId)));
  }

  async updateStatus(
    user: { tenantId: string; userId: string },
    allocationId: string,
    next: WorkerStatus,
    note: string | undefined,
    requestId: string
  ) {
    this.assertEnabled();
    const row = await this.prisma.taskAllocation.findFirst({ where: { id: allocationId, tenantId: user.tenantId, userId: user.userId } });
    if (!row) throw new NotFoundException();
    const allowed = TRANSITIONS[row.status] ?? [];
    if (!allowed.includes(next)) {
      throw new UnprocessableEntityException("Transición de estado no permitida");
    }
    if (next === "BLOCKED" && !note) {
      throw new UnprocessableEntityException("Indica el motivo del bloqueo");
    }
    const claimed = await this.prisma.taskAllocation.updateMany({
      where: { id: row.id, status: row.status },
      data: {
        status: next,
        statusNote: note ?? null,
        ...(next === "ACKNOWLEDGED" ? { acknowledgedAt: new Date() } : {})
      }
    });
    if (claimed.count !== 1) throw new ConflictException("La asignación cambió; vuelve a intentar");
    await this.record(user.tenantId, row.orgId, user.userId, "task_allocation.status_changed", row.id, requestId, { from: row.status, to: next });
    return { status: next };
  }

  /** Títulos de las tareas canónicas, para mostrar algo legible (solo lectura, acotado al tenant). */
  private async titles(tenantId: string, taskIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(taskIds)];
    if (unique.length === 0) return new Map();
    const tasks = await this.prisma.jobTask.findMany({ where: { tenantId, id: { in: unique } } });
    return new Map(tasks.map((t) => [t.id, t.title]));
  }

  private view(row: AllocationRow, taskTitle?: string) {
    return {
      allocationId: row.id,
      taskTitle: taskTitle ?? null,
      orgId: row.orgId,
      taskId: row.taskId,
      crewId: row.crewId,
      userId: row.userId,
      status: row.status,
      assignReason: row.assignReason,
      statusNote: row.statusNote,
      assignedAt: row.assignedAt,
      acknowledgedAt: row.acknowledgedAt,
      releasedAt: row.releasedAt,
      releaseReason: row.releaseReason
    };
  }
}
