import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { hasPermission } from "../../common/rbac.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { summarizeExperience } from "../professional-skills/skills.calc.js";

/**
 * BO-13 — herramientas de SOLO LECTURA de Prometeo sobre Business OS.
 * Spec: docs/specs/core/prometeo-business-os.spec.md
 *
 * Aprobado por el propietario (2026-10-18): lectura y borradores con revisión humana.
 * Ninguna herramienta escribe, aprueba, firma ni decide. No hay modelo de lenguaje aquí:
 * el borrador del reporte es texto determinista armado desde el reporte ya generado,
 * así que no puede inventar horas ni descansos. Cada llamada respeta el alcance de quien
 * pregunta (lo suyo, o la cuadrilla que supervisa / gestiona).
 */
const CREWS_MANAGE = "org:crews:manage";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type BusinessOsActor = { tenantId: string; orgId: string; userId: string; roles: string[] };

export function isPrometeoBusinessOsEnabled(): boolean {
  return process.env.SEMSE_PROMETEO_BUSINESS_OS_ENABLED === "true";
}

/** Marca de bloqueo que `invokeReadTool` ya sabe convertir en una ejecución "blocked" auditada. */
export const BUSINESS_OS_DISABLED = { __blockedReason: "Las herramientas de Business OS no están habilitadas" } as const;

function requiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new NotFoundException();
  }
  return value.trim();
}

@Injectable()
export class BusinessOsToolsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Supervisor vigente de la cuadrilla o gestor de cuadrillas de su Org; membresía revalidada. */
  private async requireCrewScope(actor: BusinessOsActor, crewId: string) {
    const crew = await this.prisma.crew.findFirst({ where: { id: crewId, tenantId: actor.tenantId, status: "ACTIVE" } });
    if (!crew) throw new NotFoundException();
    const live = await this.prisma.membership.findMany({
      where: { userId: actor.userId, orgId: crew.orgId, status: "ACTIVE", org: { tenantId: actor.tenantId } },
      include: { role: true }
    });
    if (live.length === 0) throw new NotFoundException();
    const manager = hasPermission(live.map((m) => m.role.key), CREWS_MANAGE);
    if (crew.supervisorUserId !== actor.userId && !manager) throw new ForbiddenException();
    return crew;
  }

  private async titles(tenantId: string, taskIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(taskIds)];
    if (unique.length === 0) return new Map();
    const tasks = await this.prisma.jobTask.findMany({ where: { tenantId, id: { in: unique } } });
    return new Map(tasks.map((t) => [t.id, t.title]));
  }

  async myAssignments(actor: BusinessOsActor) {
    if (!isPrometeoBusinessOsEnabled()) return BUSINESS_OS_DISABLED;
    const rows = await this.prisma.taskAllocation.findMany({ where: { tenantId: actor.tenantId, userId: actor.userId } });
    const live = rows.filter((r) => r.status !== "RELEASED");
    const titles = await this.titles(actor.tenantId, live.map((r) => r.taskId));
    return live.map((r) => ({
      allocationId: r.id,
      taskId: r.taskId,
      taskTitle: titles.get(r.taskId) ?? null,
      status: r.status,
      statusNote: r.statusNote,
      assignedAt: r.assignedAt
    }));
  }

  async mySkills(actor: BusinessOsActor) {
    if (!isPrometeoBusinessOsEnabled()) return BUSINESS_OS_DISABLED;
    const rows = await this.prisma.skillExperience.findMany({ where: { userId: actor.userId, status: "CONFIRMED" } });
    return summarizeExperience(rows.map((r) => ({ trade: r.trade, decidedAt: r.decidedAt })), new Date());
  }

  async crewTasks(actor: BusinessOsActor, input: Record<string, unknown>) {
    if (!isPrometeoBusinessOsEnabled()) return BUSINESS_OS_DISABLED;
    const crew = await this.requireCrewScope(actor, requiredString(input, "crewId"));
    const rows = await this.prisma.jobTask.findMany({
      where: { tenantId: actor.tenantId, orgId: crew.orgId, entityType: "Crew", entityId: crew.id }
    });
    return rows.map((t) => ({ taskId: t.id, title: t.title, priority: t.priority, status: t.status, dueDate: t.dueDate }));
  }

  /** Aviso de tareas bloqueadas: hechos para que el responsable actúe; Prometeo no reasigna nada. */
  async crewBlocked(actor: BusinessOsActor, input: Record<string, unknown>) {
    if (!isPrometeoBusinessOsEnabled()) return BUSINESS_OS_DISABLED;
    const crew = await this.requireCrewScope(actor, requiredString(input, "crewId"));
    const rows = await this.prisma.taskAllocation.findMany({ where: { tenantId: actor.tenantId, crewId: crew.id, status: "BLOCKED" } });
    const titles = await this.titles(actor.tenantId, rows.map((r) => r.taskId));
    return rows.map((r) => ({
      allocationId: r.id,
      taskId: r.taskId,
      taskTitle: titles.get(r.taskId) ?? null,
      userId: r.userId,
      reason: r.statusNote
    }));
  }

  /**
   * Borrador de texto del reporte diario. Determinista: usa solo el snapshot ya generado y lo
   * marca como borrador que un humano debe revisar. No publica, no revisa, no cambia el reporte.
   */
  async draftReportSummary(actor: BusinessOsActor, input: Record<string, unknown>) {
    if (!isPrometeoBusinessOsEnabled()) return BUSINESS_OS_DISABLED;
    const crew = await this.requireCrewScope(actor, requiredString(input, "crewId"));
    const reportDate = requiredString(input, "reportDate");
    if (!DATE_RE.test(reportDate)) throw new NotFoundException();
    const report = await this.prisma.dailyReport.findFirst({ where: { tenantId: actor.tenantId, crewId: crew.id, reportDate } });
    if (!report) return { __blockedReason: "No hay un reporte generado para esa fecha; genéralo primero" };
    const snap = report.snapshot as {
      crewWorkedMinutes: number;
      openEntries: number;
      workers: { userId: string; workedMinutes: number; openEntries: number }[];
      tasksCompleted: { title: string }[];
      limitations: string[];
    };
    const hours = (m: number) => (m / 60).toFixed(2);
    const lines = [
      `Reporte del ${reportDate} (estado: ${report.status}).`,
      `Horas registradas de la cuadrilla: ${hours(snap.crewWorkedMinutes)} h.`,
      ...snap.workers.map((w) => `- ${w.userId}: ${hours(w.workedMinutes)} h${w.openEntries > 0 ? ` (${w.openEntries} registro(s) abierto(s) sin horas)` : ""}.`),
      snap.tasksCompleted.length > 0 ? `Tareas cerradas: ${snap.tasksCompleted.map((t) => t.title).join("; ")}.` : "No hubo tareas cerradas ese día.",
      snap.openEntries > 0 ? `Atención: ${snap.openEntries} registro(s) abierto(s) no suman horas hasta que se cierren.` : "",
      `Limitaciones: ${snap.limitations.join(" ")}`
    ].filter((line) => line.length > 0);
    return {
      draft: true,
      requiresHumanReview: true,
      basedOnReportHash: report.contentHash,
      text: lines.join("\n")
    };
  }
}
