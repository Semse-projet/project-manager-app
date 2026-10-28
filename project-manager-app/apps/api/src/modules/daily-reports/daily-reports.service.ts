import { createHash } from "node:crypto";
import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { hasPermission } from "../../common/rbac.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

/**
 * BO-11 — reporte diario de cuadrilla con manifest hash y revisión humana.
 * Spec: docs/specs/core/daily-reports.spec.md
 *
 * El reporte es una FOTO de lo que ya está en `TimeEntry` y `JobTask`; no calcula
 * nómina, no usa GPS y no inventa horas: un registro abierto o sin terminar se
 * lista como tal, nunca como horas trabajadas. Lo genera el supervisor, lo
 * revisa otra persona y recién entonces queda congelado.
 */
const MANAGE = "org:crews:manage";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ReportActor = { tenantId: string; userId: string; roles: string[] };

export function isDailyReportsEnabled(): boolean {
  return process.env.SEMSE_DAILY_REPORTS_ENABLED === "true";
}

/** Serialización estable (claves ordenadas) para que el hash no dependa del orden de inserción. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export function hashSnapshot(snapshot: unknown): string {
  return createHash("sha256").update(stableStringify(snapshot)).digest("hex");
}

export function dayWindow(reportDate: string, tzOffsetMinutes: number): { start: Date; end: Date } {
  if (!DATE_RE.test(reportDate)) throw new UnprocessableEntityException("Fecha no válida");
  const [y, m, d] = reportDate.split("-").map(Number);
  const utcMidnight = new Date(Date.UTC(y, m - 1, d));
  if (utcMidnight.getUTCFullYear() !== y || utcMidnight.getUTCMonth() !== m - 1 || utcMidnight.getUTCDate() !== d) {
    throw new UnprocessableEntityException("Fecha no válida");
  }
  const start = new Date(utcMidnight.getTime() - tzOffsetMinutes * 60_000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60_000) };
}

type ReportRow = {
  id: string;
  orgId: string;
  crewId: string;
  worksiteId: string | null;
  reportDate: string;
  tzOffsetMinutes: number;
  status: string;
  snapshot: unknown;
  contentHash: string;
  notes: string | null;
  generatedByUserId: string;
  generatedAt: Date;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  publishedAt: Date | null;
};

@Injectable()
export class DailyReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private assertEnabled(): void {
    if (!isDailyReportsEnabled()) {
      throw new NotFoundException();
    }
  }

  private async liveRoles(actor: ReportActor, orgId: string): Promise<string[]> {
    const live = await this.prisma.membership.findMany({
      where: { userId: actor.userId, orgId, status: "ACTIVE", org: { tenantId: actor.tenantId } },
      include: { role: true }
    });
    if (live.length === 0) throw new NotFoundException();
    return live.map((m) => m.role.key);
  }

  /** Supervisor vigente de la cuadrilla o gestor de cuadrillas de la Org (membresía revalidada). */
  private async requireCrewScope(actor: ReportActor, crewId: string) {
    const crew = await this.prisma.crew.findFirst({ where: { id: crewId, tenantId: actor.tenantId, status: "ACTIVE" } });
    if (!crew) throw new NotFoundException();
    const roles = await this.liveRoles(actor, crew.orgId);
    if (crew.supervisorUserId !== actor.userId && !hasPermission(roles, MANAGE)) throw new ForbiddenException();
    return crew;
  }

  private async requireReviewer(actor: ReportActor, orgId: string): Promise<void> {
    const roles = await this.liveRoles(actor, orgId);
    if (!hasPermission(roles, MANAGE)) throw new ForbiddenException();
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
      entityType: "DailyReport",
      entityId,
      requestId,
      timestamp: new Date().toISOString(),
      afterJson
    });
  }

  async generate(
    actor: ReportActor,
    crewId: string,
    requestId: string,
    input: { reportDate: string; tzOffsetMinutes?: number; notes?: string }
  ) {
    this.assertEnabled();
    const crew = await this.requireCrewScope(actor, crewId);
    const tz = input.tzOffsetMinutes ?? 0;
    const { start, end } = dayWindow(input.reportDate, tz);
    const existing = await this.prisma.dailyReport.findFirst({ where: { crewId: crew.id, reportDate: input.reportDate } });
    if (existing && existing.status !== "DRAFT") {
      throw new ConflictException("El reporte ya fue revisado y no se puede regenerar");
    }
    const members = await this.prisma.crewMember.findMany({ where: { crewId: crew.id, status: "ACTIVE" } });
    const memberIds = members.map((m) => m.userId).sort();
    const entries = memberIds.length
      ? await this.prisma.timeEntry.findMany({
          where: { tenantId: actor.tenantId, orgId: crew.orgId, createdBy: { in: memberIds }, startedAt: { gte: start, lt: end }, status: { not: "deleted" } },
          orderBy: { startedAt: "asc" }
        })
      : [];
    const tasks = memberIds.length
      ? await this.prisma.jobTask.findMany({
          where: { tenantId: actor.tenantId, orgId: crew.orgId, assignedTo: { in: memberIds }, completedAt: { gte: start, lt: end } }
        })
      : [];

    let openEntries = 0;
    const workers = memberIds.map((userId) => {
      const mine = entries.filter((e) => e.createdBy === userId);
      const rows = mine.map((e) => {
        const finished = e.endedAt !== null;
        const elapsed = finished ? Math.floor((e.endedAt!.getTime() - e.startedAt.getTime()) / 60_000) : null;
        const workedMinutes = elapsed === null ? null : Math.max(0, elapsed - Math.min(Math.max(0, e.breakMinutes), elapsed));
        if (!finished) openEntries += 1;
        return {
          timeEntryId: e.id,
          startedAt: e.startedAt,
          endedAt: e.endedAt,
          breakMinutes: e.breakMinutes,
          workedMinutes,
          status: e.status,
          edited: e.editedBy ? true : false
        };
      });
      return {
        userId,
        entries: rows,
        workedMinutes: rows.reduce((sum, r) => sum + (r.workedMinutes ?? 0), 0),
        openEntries: rows.filter((r) => r.workedMinutes === null).length
      };
    });
    const snapshot = {
      version: 1,
      orgId: crew.orgId,
      crewId: crew.id,
      worksiteId: crew.worksiteId ?? null,
      reportDate: input.reportDate,
      tzOffsetMinutes: tz,
      supervisorUserId: crew.supervisorUserId,
      workers,
      crewWorkedMinutes: workers.reduce((sum, w) => sum + w.workedMinutes, 0),
      openEntries,
      tasksCompleted: tasks.map((t) => ({ taskId: t.id, title: t.title, assignedTo: t.assignedTo })).sort((a, b) => (a.taskId < b.taskId ? -1 : 1)),
      sources: { timeEntryIds: entries.map((e) => e.id).sort(), taskIds: tasks.map((t) => t.id).sort() },
      limitations: [
        "Horas tomadas de los registros de tiempo existentes; no se calcula nómina.",
        "Los registros abiertos se listan sin horas y los no sincronizados pueden faltar.",
        "Solo incluye a los miembros activos de la cuadrilla al generar el reporte.",
        "No usa ubicación (GPS)."
      ]
    };
    const contentHash = hashSnapshot(snapshot);
    const now = new Date();
    let row: ReportRow;
    if (existing) {
      const updated = await this.prisma.dailyReport.updateMany({
        where: { id: existing.id, status: "DRAFT" },
        data: { snapshot, contentHash, notes: input.notes ?? null, tzOffsetMinutes: tz, generatedByUserId: actor.userId, generatedAt: now }
      });
      if (updated.count !== 1) throw new ConflictException("El reporte cambió; vuelve a intentar");
      row = { ...existing, snapshot, contentHash, notes: input.notes ?? null, tzOffsetMinutes: tz, generatedByUserId: actor.userId, generatedAt: now };
    } else {
      row = await this.prisma.dailyReport.create({
        data: {
          tenantId: actor.tenantId,
          orgId: crew.orgId,
          crewId: crew.id,
          worksiteId: crew.worksiteId ?? null,
          reportDate: input.reportDate,
          tzOffsetMinutes: tz,
          snapshot,
          contentHash,
          notes: input.notes ?? null,
          generatedByUserId: actor.userId,
          generatedAt: now
        }
      });
    }
    await this.record(actor.tenantId, crew.orgId, actor.userId, "daily_report.generated", row.id, requestId, {
      crewId: crew.id,
      reportDate: input.reportDate,
      contentHash
    });
    return this.view(row);
  }

  async listForCrew(actor: ReportActor, crewId: string) {
    this.assertEnabled();
    const crew = await this.requireCrewScope(actor, crewId);
    const rows = await this.prisma.dailyReport.findMany({ where: { tenantId: actor.tenantId, crewId: crew.id } });
    return rows.map((row) => this.view(row, false));
  }

  async getForCrew(actor: ReportActor, crewId: string, reportDate: string) {
    this.assertEnabled();
    const crew = await this.requireCrewScope(actor, crewId);
    const row = await this.prisma.dailyReport.findFirst({ where: { tenantId: actor.tenantId, crewId: crew.id, reportDate } });
    if (!row) throw new NotFoundException();
    return this.view(row);
  }

  async review(actor: ReportActor, reportId: string, decision: "APPROVE" | "RETURN", note: string | undefined, requestId: string) {
    this.assertEnabled();
    const row = await this.prisma.dailyReport.findFirst({ where: { id: reportId, tenantId: actor.tenantId } });
    if (!row) throw new NotFoundException();
    await this.requireReviewer(actor, row.orgId);
    if (row.generatedByUserId === actor.userId) {
      throw new ForbiddenException("No se puede revisar el propio reporte");
    }
    if (decision === "RETURN" && !note) {
      throw new UnprocessableEntityException("Indica el motivo de la devolución");
    }
    const claimed = await this.prisma.dailyReport.updateMany({
      where: { id: row.id, status: "DRAFT", contentHash: row.contentHash },
      data:
        decision === "APPROVE"
          ? { status: "REVIEWED", reviewedByUserId: actor.userId, reviewedAt: new Date(), reviewNote: note ?? null }
          : { reviewNote: note ?? null }
    });
    if (claimed.count !== 1) throw new ConflictException("El reporte ya fue revisado o cambió");
    await this.record(
      actor.tenantId,
      row.orgId,
      actor.userId,
      decision === "APPROVE" ? "daily_report.reviewed" : "daily_report.returned",
      row.id,
      requestId,
      { contentHash: row.contentHash }
    );
    return { status: decision === "APPROVE" ? "REVIEWED" : "DRAFT" };
  }

  async publish(actor: ReportActor, reportId: string, requestId: string) {
    this.assertEnabled();
    const row = await this.prisma.dailyReport.findFirst({ where: { id: reportId, tenantId: actor.tenantId } });
    if (!row) throw new NotFoundException();
    await this.requireReviewer(actor, row.orgId);
    const claimed = await this.prisma.dailyReport.updateMany({
      where: { id: row.id, status: "REVIEWED" },
      data: { status: "PUBLISHED", publishedByUserId: actor.userId, publishedAt: new Date() }
    });
    if (claimed.count !== 1) throw new ConflictException("Solo se publica un reporte revisado");
    await this.record(actor.tenantId, row.orgId, actor.userId, "daily_report.published", row.id, requestId, { contentHash: row.contentHash });
    return { status: "PUBLISHED" as const };
  }

  private view(row: ReportRow, withSnapshot = true) {
    return {
      reportId: row.id,
      orgId: row.orgId,
      crewId: row.crewId,
      worksiteId: row.worksiteId,
      reportDate: row.reportDate,
      tzOffsetMinutes: row.tzOffsetMinutes,
      status: row.status,
      contentHash: row.contentHash,
      notes: row.notes,
      generatedByUserId: row.generatedByUserId,
      generatedAt: row.generatedAt,
      reviewedByUserId: row.reviewedByUserId,
      reviewedAt: row.reviewedAt,
      reviewNote: row.reviewNote,
      publishedAt: row.publishedAt,
      ...(withSnapshot ? { snapshot: row.snapshot } : {})
    };
  }
}
