import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { AgroAuditRepository } from "./agro-audit.repository.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";
import { AgroFarmAccessService, authorizeFarmAction } from "./agro-farm-access.service.js";
import type { AgroFarmAction } from "./agro-farm-policy.js";
import { AgroTaskRepository } from "./agro-task.repository.js";

export const AGRO_TASK_TYPES = [
  "FEEDING", "VACCINATION", "TREATMENT", "WEIGHING", "MOVEMENT",
  "CLEANING", "INSPECTION", "INVENTORY", "SALE", "WATER_CHECK",
  // Reproducción (pantalla /agro/[farmId]/reproduction los usaba y el API los rechazaba con 400).
  "BREEDING", "PREGNANCY_CHECK", "BIRTH", "WEANING", "HEAT_DETECTION",
  "OTHER",
] as const;

const VALID_TYPES = AGRO_TASK_TYPES;

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const VALID_TARGET_TYPES = [
  "ANIMAL", "ANIMAL_GROUP", "FARM_UNIT", "INVENTORY", "GENERAL",
] as const;

// FSM: allowed transitions
const TRANSITIONS: Record<string, string[]> = {
  PENDING:     ["IN_PROGRESS", "BLOCKED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "BLOCKED", "CANCELLED"],
  BLOCKED:     ["PENDING", "IN_PROGRESS", "CANCELLED"],
  COMPLETED:   [],
  CANCELLED:   [],
};

@Injectable()
export class AgroTaskService {
  constructor(
    private readonly repo: AgroTaskRepository,
    private readonly farmRepo: AgroFarmRepository,
    private readonly audit: AgroAuditRepository,
    @Optional() private readonly access?: AgroFarmAccessService,
  ) {}

  /** Un responsable debe ser miembro activo o propietario de la finca (solo con AgroFarmAccessService). */
  private async assertAssignable(farmId: string, userId: string) {
    if (!this.access) return;
    if (!(await this.access.resolveRole(farmId, userId))) {
      throw new BadRequestException(`Assignee is not an active member of this farm: ${userId}`);
    }
  }

  /** Política de rol de finca (T-050); sin AgroFarmAccessService, solo el propietario. */
  private authorize(farmId: string, userId: string, action: AgroFarmAction, opts: { isAssignee?: boolean } = {}) {
    return authorizeFarmAction(this.access, this.farmRepo, farmId, userId, action, opts);
  }

  async listTasks(farmId: string, ownerId: string, filters?: { status?: string; targetType?: string; targetId?: string }) {
    await this.authorize(farmId, ownerId, "farm.read");
    return this.repo.listTasks(farmId, filters);
  }

  async getTask(taskId: string) {
    const task = await this.repo.findTask(taskId);
    if (!task) throw new NotFoundException(`Task not found: ${taskId}`);
    return task;
  }

  /** Lectura autorizada por finca (evita leer registros de fincas ajenas por id). */
  async getTaskForUser(taskId: string, userId: string) {
    const row = await this.getTask(taskId);
    await this.authorize(row.farmId, userId, "farm.read");
    return row;
  }

  async listEntityTasks(farmId: string, ownerId: string, targetType: string, targetId: string) {
    await this.authorize(farmId, ownerId, "farm.read");
    return this.repo.listTasks(farmId, { targetType, targetId });
  }

  async createTask(farmId: string, ownerId: string, input: {
    title: string;
    type: string;
    targetType?: string;
    targetId?: string;
    assignedToId?: string;
    priority?: string;
    dueAt?: Date;
    notes?: string;
  }) {
    await this.authorize(farmId, ownerId, "task.create");
    if (!input.title?.trim()) throw new BadRequestException("Task title is required");
    if (!VALID_TYPES.includes(input.type as any)) {
      throw new BadRequestException(`Invalid task type: ${input.type}`);
    }
    if (input.priority && !VALID_PRIORITIES.includes(input.priority as any)) {
      throw new BadRequestException(`Invalid priority: ${input.priority}`);
    }
    if (input.targetType && !VALID_TARGET_TYPES.includes(input.targetType as any)) {
      throw new BadRequestException(`Invalid targetType: ${input.targetType}`);
    }

    if (input.assignedToId) await this.assertAssignable(farmId, input.assignedToId);

    const task = await this.repo.createTask({ farmId, ...input });
    await this.audit.record({
      farmId, actorId: ownerId,
      entityType: "AgroFarmTask", entityId: task.id,
      action: "task.created",
      after: { title: task.title, type: task.type, status: task.status },
      source: "WEB",
    });
    return task;
  }

  async updateTask(taskId: string, ownerId: string, input: {
    title?: string;
    assignedToId?: string;
    priority?: string;
    dueAt?: Date | null;
    notes?: string;
  }) {
    const task = await this.getTask(taskId);
    await this.authorize(task.farmId, ownerId, "task.update");
    if (["COMPLETED", "CANCELLED"].includes(task.status)) {
      throw new BadRequestException(`Cannot edit task with status: ${task.status}`);
    }
    if (input.priority && !VALID_PRIORITIES.includes(input.priority as any)) {
      throw new BadRequestException(`Invalid priority: ${input.priority}`);
    }

    if (input.assignedToId) await this.assertAssignable(task.farmId, input.assignedToId);

    const updated = await this.repo.updateTask(taskId, input);
    await this.audit.record({
      farmId: task.farmId, actorId: ownerId,
      entityType: "AgroFarmTask", entityId: taskId,
      action: "task.updated",
      before: { title: task.title, priority: task.priority },
      after: { title: updated.title, priority: updated.priority },
      source: "WEB",
    });
    return updated;
  }

  private async transition(taskId: string, ownerId: string, toStatus: string, extra?: {
    blockReason?: string;
    cancelReason?: string;
  }) {
    const task = await this.getTask(taskId);
    // Cancelar es de supervisión; iniciar/completar/bloquear lo hace también el
    // trabajador si la tarea es suya o no está asignada a nadie.
    await this.authorize(task.farmId, ownerId, toStatus === "CANCELLED" ? "task.update" : "task.execute", {
      isAssignee: !task.assignedToId || task.assignedToId === ownerId,
    });
    const allowed = TRANSITIONS[task.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(`Cannot transition task from ${task.status} to ${toStatus}`);
    }

    const now = new Date();
    const patch: Parameters<typeof this.repo.updateTask>[1] = { status: toStatus };
    if (toStatus === "IN_PROGRESS") patch.startedAt = now;
    if (toStatus === "COMPLETED")   patch.completedAt = now;
    if (toStatus === "BLOCKED")     { patch.blockedAt = now; patch.blockReason = extra?.blockReason ?? null; }
    if (toStatus === "CANCELLED")   { patch.cancelledAt = now; patch.cancelReason = extra?.cancelReason ?? null; }

    const updated = await this.repo.updateTask(taskId, patch);
    await this.audit.record({
      farmId: task.farmId, actorId: ownerId,
      entityType: "AgroFarmTask", entityId: taskId,
      action: `task.${toStatus.toLowerCase()}`,
      before: { status: task.status },
      after: { status: toStatus, ...extra },
      source: "WEB",
    });
    return updated;
  }

  async startTask(taskId: string, ownerId: string) {
    return this.transition(taskId, ownerId, "IN_PROGRESS");
  }

  async completeTask(taskId: string, ownerId: string) {
    return this.transition(taskId, ownerId, "COMPLETED");
  }

  async blockTask(taskId: string, ownerId: string, reason?: string) {
    return this.transition(taskId, ownerId, "BLOCKED", { blockReason: reason });
  }

  async cancelTask(taskId: string, ownerId: string, reason?: string) {
    return this.transition(taskId, ownerId, "CANCELLED", { cancelReason: reason });
  }

  async getTaskTimeline(taskId: string, ownerId: string) {
    const task = await this.getTask(taskId);
    await this.authorize(task.farmId, ownerId, "farm.read");
    return this.repo.getEntityTimeline(task.farmId, "AgroFarmTask", taskId);
  }
}
