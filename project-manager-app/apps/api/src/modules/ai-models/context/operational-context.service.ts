import { forwardRef, ForbiddenException, Inject, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { hasScopeAccess, isOpsAdmin, type ScopeActor } from "../../../common/resource-scope.js";
import { ResourceScopeResolver } from "../../../common/resource-scope.resolver.js";
import { SseEventBusService } from "../../../infrastructure/sse/sse-event-bus.service.js";
import { HealthService } from "../../health/health.service.js";
import { hasPermission } from "../../../common/rbac.js";
import type { ProjectScope } from "../../../common/resource-scope.js";
import { FinanceService } from "../../finance/finance.service.js";
import { Ecosystem5DService, type Ecosystem5DView } from "../../intelligence/ecosystem-5d.service.js";
import { RiskScoringService } from "../../intelligence/risk-scoring.service.js";
import {
  isJobsBidsProjectionEnabled,
  isJobsBidsProjectionReadthroughEnabled,
} from "../../jobs/jobs-bids-projection.js";
import { buildJobVisibilityWhere, jobVisibilityKind } from "../../jobs/jobs-visibility.js";

export type SemseOperationalContext = {
  mode: "demo" | "local" | "live";
  user: { id: string; role: string; tenantId: string; orgId: string };
  assistantSettings: {
    assistantTone?: string;
    assistantLanguage?: string;
    assistantVerbosity?: string;
    unifiedMode: boolean;
    expertMode: boolean;
  };
  activeProject: { id: string; title: string; status: string; jobId?: string } | null;
  preferredProfessional: {
    userId: string;
    displayName: string;
    publicSlug: string | null;
    selectedAt: string | null;
    trustScore: number | null;
    completedProjects: number | null;
    specialties: string[];
  } | null;
  jobs: { active: number; waitingProposals: number; completed: number; recent: Array<{ id: string; title: string; status: string }> };
  milestones: { active: number; pendingApproval: number; submitted: number };
  payments: { escrowFunded: number; escrowReleased: number; pendingRelease: number };
  evidences: { total: number; pendingReview: number; approved: number };
  disputes: { open: number; urgent: number };
  notifications: Array<{ id: string; type: string; body: string; createdAt: Date }>;
  systemHealth: { api: "ok" | "degraded"; worker: "ok" | "degraded"; redis: "ok" | "degraded" };
  finance: {
    totalInvoiced: number; totalPaid: number; totalPending: number;
    totalExpenses: number; invoiceCount: number; expenseCount: number;
    margin: number | null; overdueCount: number;
    expensesByCategory: Record<string, number>;
  } | null;
  ecosystem5d: Ecosystem5DView | null;
  risk: {
    overallScore: number;
    level: "low" | "medium" | "high" | "critical";
    disputeRisk: number;
    budgetOverrunRisk: number;
    scheduleRisk: number;
    recommendations: string[];
  } | null;
  generatedAt: string;
};

type JobSummaryRow = { id: string; title: string; status: string };
type NotificationSummaryRow = { id: string; type: string; body: string; createdAt: Date };
type UserProfileSummaryRow = {
  assistantTone: string | null;
  assistantLanguage: string | null;
  assistantVerbosity: string | null;
  unifiedMode: boolean;
  expertMode: boolean;
};
type ProjectSummaryRow = { id: string; status: string; jobId: string | null; job: { title: string } };
type MilestoneStatusRow = { status: string };
type EvidenceStatusRow = { validationStatus: string | null };
type DisputeStatusRow = { status: string };
type PreferredProfessionalContextView = SemseOperationalContext["preferredProfessional"];
type ContextInvalidationScope = "tenant" | "project" | "user";
type ContextInvalidationInput = {
  tenantId: string;
  projectId?: string | null;
  userId?: string | null;
  source: string;
  reason?: string;
};

const CONTEXT_TTL_SECONDS = 60;

function resolveRuntimeMode(): SemseOperationalContext["mode"] {
  const explicit = process.env.SEMSE_RUNTIME_MODE?.trim().toLowerCase();
  if (explicit === "demo" || explicit === "local" || explicit === "live") {
    return explicit;
  }

  if (process.env.NODE_ENV === "production") {
    return "live";
  }

  return process.env.SEMSE_DEMO_MODE === "true" ? "demo" : "local";
}

@Injectable()
export class OperationalContextService {
  private readonly logger = new Logger(OperationalContextService.name);
  private readonly cache = new Map<string, { ctx: SemseOperationalContext; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly healthService?: HealthService,
    @Optional() private readonly sseBus?: SseEventBusService,
    @Optional() @Inject(forwardRef(() => FinanceService)) private readonly financeService?: FinanceService,
    @Optional() private readonly ecosystem5dService?: Ecosystem5DService,
    @Optional() private readonly riskService?: RiskScoringService,
  ) {}

  /**
   * El actor con el que se decide el alcance. `roles` es la lista completa del
   * actor; si un llamador solo conoce `role` (el primero), se usa ese solo y
   * nunca se asume `OPS_ADMIN`: ante la duda, el alcance más estrecho.
   */
  private scopeActor(input: { tenantId: string; orgId: string; userId: string; role: string; roles?: string[] }): ScopeActor {
    const roles = input.roles && input.roles.length > 0 ? input.roles : [input.role];
    return { tenantId: input.tenantId, orgId: input.orgId, userId: input.userId, roles };
  }

  /**
   * Un `projectId` solo abre los bloques de proyecto (finanzas, riesgo y el lente 5D de proyecto) si el
   * actor participa en ese proyecto: org cliente, org profesional asignada u OPS_ADMIN del mismo tenant.
   * Mismo contrato que `IntelligenceController.assertProjectAccess` y la spec resource-scope:
   * inexistente u otro tenant ⇒ 404; otra org del mismo tenant ⇒ 403.
   */
  private async assertProjectAccess(actor: ScopeActor, projectId: string): Promise<ProjectScope> {
    const scope = await new ResourceScopeResolver(this.prisma).resolveProjectScope(actor.tenantId, projectId);
    if (!scope) throw new NotFoundException("Project not found");
    if (!hasScopeAccess(actor, scope, "read")) throw new ForbiddenException("Actor cannot access this project");
    return scope;
  }

  async buildContext(input: {
    tenantId: string; orgId: string; userId: string; role: string; roles?: string[]; projectId?: string;
  }): Promise<SemseOperationalContext> {
    const actorScope = this.scopeActor(input);
    // Antes de la caché: perder la participación en un proyecto no debe seguir sirviendo su contexto.
    const projectScope = input.projectId ? await this.assertProjectAccess(actorScope, input.projectId) : null;
    const canReadFinancials = !!projectScope && hasScopeAccess(actorScope, projectScope, "client") && hasPermission(actorScope.roles, "finance:read");
    const isAdmin = isOpsAdmin(actorScope);
    const cacheKey = `${input.tenantId}:${input.orgId}:${input.userId}:${isAdmin ? "admin" : "user"}:${input.projectId ?? "none"}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      if (!canReadFinancials) return { ...cached.ctx, finance: null };
      if (input.projectId && cached.ctx.finance && this.financeService) {
        try { await this.financeService.getProjectSummary(actorScope, input.projectId); }
        catch { return { ...cached.ctx, finance: null }; }
      }
      return cached.ctx;
    }
    // 0.39: los trabajos siguen la misma regla de visibilidad que la API de trabajos (2.27), no el tenant completo.
    const jobsWhere: Prisma.JobWhereInput = {
      tenantId: input.tenantId,
      deletedAt: null,
      ...buildJobVisibilityWhere({ orgId: input.orgId, userId: input.userId, roles: actorScope.roles }),
    };

    const [jobs, notifications, assistantProfile] = await Promise.all([
      this.loadJobsSummary({ ...input, roles: actorScope.roles }, jobsWhere),
      this.prisma.notification.findMany({
        where: { tenantId: input.tenantId, userId: input.userId, readAt: null },
        orderBy: { createdAt: "desc" }, take: 10,
        select: { id: true, type: true, body: true, createdAt: true },
      }).catch(() => [] as NotificationSummaryRow[]),
      this.prisma.userProfile.findUnique({
        where: { userId: input.userId },
        select: {
          assistantTone: true,
          assistantLanguage: true,
          assistantVerbosity: true,
          unifiedMode: true,
          expertMode: true,
        },
      }).catch(() => null as UserProfileSummaryRow | null),
    ]);

    const activeJobs = jobs.filter((j: JobSummaryRow) => ["IN_PROGRESS", "RESERVED", "ACCEPTED"].includes(j.status));
    const waitingJobs = jobs.filter((j: JobSummaryRow) => j.status === "POSTED" || j.status === "PUBLISHED");
    const completedJobs = jobs.filter((j: JobSummaryRow) => j.status === "COMPLETED");

    // Load project data if projectId given
    let activeProject: SemseOperationalContext["activeProject"] = null;
    let preferredProfessional: PreferredProfessionalContextView = null;
    let milestones = { active: 0, pendingApproval: 0, submitted: 0 };
    let payments = { escrowFunded: 0, escrowReleased: 0, pendingRelease: 0 };
    let evidences = { total: 0, pendingReview: 0, approved: 0 };
    let disputes = { open: 0, urgent: 0 };

    if (!input.projectId) {
      // Aggregate across ALL tenant projects for global view
      const [allEscrows, allMilestones, allDisputes, allEvidences] = await Promise.all([
        this.prisma.paymentEscrow.findMany({
          where: { project: { tenantId: input.tenantId } },
          select: { totalAmount: true, status: true },
        }).catch(() => []),
        this.prisma.milestone.findMany({
          where: { project: { tenantId: input.tenantId } },
          select: { status: true },
        }).catch(() => []),
        this.prisma.dispute.findMany({
          where: { tenantId: input.tenantId },
          select: { status: true },
        }).catch(() => []),
        this.prisma.evidence.findMany({
          where: { project: { tenantId: input.tenantId } },
          select: { validationStatus: true },
        }).catch(() => []),
      ]);

      const totalEscrow = allEscrows.reduce((s: number, e: { totalAmount: unknown }) => s + Number(e.totalAmount ?? 0), 0);
      payments = {
        escrowFunded: totalEscrow,
        escrowReleased: 0,
        pendingRelease: allMilestones.filter((m: MilestoneStatusRow) => m.status === "APPROVED").length > 0
          ? Math.round(totalEscrow * 0.3)
          : 0,
      };
      milestones = {
        active: allMilestones.filter((m: MilestoneStatusRow) => ["DRAFT", "AWAITING_REVIEW"].includes(m.status)).length,
        pendingApproval: allMilestones.filter((m: MilestoneStatusRow) => m.status === "AWAITING_REVIEW").length,
        submitted: allMilestones.filter((m: MilestoneStatusRow) => m.status === "SUBMITTED").length,
      };
      disputes = {
        open: allDisputes.filter((d: DisputeStatusRow) => ["OPEN", "ASSIGNED", "UNDER_REVIEW"].includes(d.status)).length,
        urgent: allDisputes.filter((d: DisputeStatusRow) => d.status === "UNDER_REVIEW").length,
      };
      evidences = {
        total: allEvidences.length,
        pendingReview: allEvidences.filter((e: EvidenceStatusRow) => e.validationStatus === "pending").length,
        approved: allEvidences.filter((e: EvidenceStatusRow) => e.validationStatus === "passed").length,
      };
    }

    if (input.projectId) {
      const [proj, mss, esc, evs, disps] = await Promise.all([
        this.prisma.project.findUnique({
          where: { id: input.projectId },
          select: { id: true, status: true, jobId: true, job: { select: { title: true } } },
        }).catch(() => null as ProjectSummaryRow | null),
        this.prisma.milestone.findMany({
          where: { projectId: input.projectId },
          select: { status: true },
        }).catch(() => [] as MilestoneStatusRow[]),
        this.prisma.paymentEscrow.findUnique({
          where: { projectId: input.projectId },
          select: { totalAmount: true, status: true },
        }).catch(() => null),
        this.prisma.evidence.findMany({
          where: { projectId: input.projectId },
          select: { validationStatus: true },
        }).catch(() => [] as EvidenceStatusRow[]),
        this.prisma.dispute.findMany({
          where: { projectId: input.projectId },
          select: { status: true },
        }).catch(() => [] as DisputeStatusRow[]),
      ]);

      if (proj) {
        activeProject = { id: proj.id, title: proj.job.title, status: proj.status, jobId: proj.jobId ?? undefined };
      }

      if (proj?.jobId) {
        preferredProfessional = await this.resolvePreferredProfessionalContext(input.tenantId, proj.jobId);
      }

      milestones = {
        active: mss.filter((m: MilestoneStatusRow) => ["DRAFT", "AWAITING_REVIEW"].includes(m.status)).length,
        pendingApproval: mss.filter((m: MilestoneStatusRow) => m.status === "AWAITING_REVIEW").length,
        submitted: mss.filter((m: MilestoneStatusRow) => m.status === "SUBMITTED").length,
      };

      const escrowTotal = Number(esc?.totalAmount ?? 0);
      const approvedMs = mss.filter((m: MilestoneStatusRow) => m.status === "APPROVED");
      payments = {
        escrowFunded: escrowTotal,
        escrowReleased: 0,
        pendingRelease: approvedMs.length > 0 ? Math.round(escrowTotal * approvedMs.length / Math.max(1, mss.length)) : 0,
      };

      evidences = {
        total: evs.length,
        pendingReview: evs.filter((e: EvidenceStatusRow) => e.validationStatus === "pending").length,
        approved: evs.filter((e: EvidenceStatusRow) => e.validationStatus === "passed").length,
      };

      disputes = {
        open: disps.filter((d: DisputeStatusRow) => ["OPEN", "ASSIGNED", "UNDER_REVIEW"].includes(d.status)).length,
        urgent: disps.filter((d: DisputeStatusRow) => d.status === "UNDER_REVIEW").length,
      };
    }

    const ctx: SemseOperationalContext = {
      mode: resolveRuntimeMode(),
      user: { id: input.userId, role: input.role, tenantId: input.tenantId, orgId: input.orgId },
      assistantSettings: {
        assistantTone: assistantProfile?.assistantTone ?? undefined,
        assistantLanguage: assistantProfile?.assistantLanguage ?? undefined,
        assistantVerbosity: assistantProfile?.assistantVerbosity ?? undefined,
        unifiedMode: assistantProfile?.unifiedMode ?? false,
        expertMode: assistantProfile?.expertMode ?? false,
      },
      activeProject,
      preferredProfessional,
      jobs: {
        active: activeJobs.length,
        waitingProposals: waitingJobs.length,
        completed: completedJobs.length,
        recent: jobs.slice(0, 5),
      },
      milestones,
      payments,
      evidences,
      disputes,
      notifications: notifications.map((n: NotificationSummaryRow) => ({ id: n.id, type: n.type, body: n.body, createdAt: n.createdAt })),
      systemHealth: this.healthService
        ? this.healthService.getHealth()
        : { api: "ok" as const, worker: "ok" as const, redis: "ok" as const },
      finance: null,
      ecosystem5d: null,
      risk: null,
      generatedAt: new Date().toISOString(),
    };

    // Sin `projectId` el lente 5D agrega TODO el tenant (proyectos, hitos, evidencias, facturas…), así que solo
    // lo recibe OPS_ADMIN, que es quien lo ve en la UI. Con `projectId` ya se verificó la participación arriba
    // y la vista es la del proyecto.
    if (this.ecosystem5dService && (input.projectId || isAdmin)) {
      try {
        ctx.ecosystem5d = await this.ecosystem5dService.buildView({
          tenantId: input.tenantId,
          projectId: input.projectId,
        });
      } catch {
        // ecosystem layer optional
      }
    }

    if (input.projectId && canReadFinancials && this.financeService) {
      try {
        const summary = await this.financeService.getProjectSummary(actorScope, input.projectId);
        const overdueInvoices = await this.financeService.listInvoices({ tenantId: input.tenantId, projectId: input.projectId, status: "overdue" }, actorScope);
        ctx.finance = {
          totalInvoiced: summary.totalInvoiced,
          totalPaid: summary.totalPaid,
          totalPending: summary.totalPending,
          totalExpenses: summary.totalExpenses,
          invoiceCount: summary.invoiceCount,
          expenseCount: summary.expenseCount,
          margin: summary.margin,
          overdueCount: overdueInvoices.length,
          expensesByCategory: summary.expensesByCategory,
        };
      } catch {
        // finance data optional — don't break context if tables are empty
      }
    }

    if (input.projectId && this.riskService) {
      try {
        const rs = await this.riskService.calculateProjectRisk(input.tenantId, input.projectId);
        ctx.risk = {
          overallScore: rs.overallScore,
          level: rs.level,
          disputeRisk: rs.disputeRisk,
          budgetOverrunRisk: rs.budgetOverrunRisk,
          scheduleRisk: rs.scheduleRisk,
          recommendations: rs.recommendations,
        };
      } catch {
        // risk data optional
      }
    }

    this.cache.set(cacheKey, { ctx, expiresAt: Date.now() + CONTEXT_TTL_SECONDS * 1000 });
    void this.persistSnapshot(input, ctx);
    this.logger.log(`[ctx] built for user=${input.userId} project=${input.projectId ?? "none"} jobs=${activeJobs.length}`);
    return ctx;
  }

  /**
   * Read-through for the `jobs` field's source data. `buildContext()` is
   * called from `POST /prometeo/chat` without a `.catch()` — this method
   * must never throw regardless of flag state or projection failure; the
   * direct query fallback at the end is not an edge case, it's the
   * required correctness backstop for that call site (see
   * docs/specs/operations/jobs-bids-event-projection.spec.md §4 P1).
   *
   * The projection is only trusted once it has caught up: `jobsBidsProjection`
   * rows are ordered by `jobId desc` (matching the direct query's `id desc`)
   * and only used when there are at least as many of them as the tenant has
   * real jobs — otherwise (still backfilling since canary was enabled, or
   * the read itself failed) this falls back to the direct query unchanged.
   */
  private async loadJobsSummary(
    input: { tenantId: string; orgId: string; roles: string[] },
    jobsWhere: Prisma.JobWhereInput,
  ): Promise<JobSummaryRow[]> {
    // La proyección solo guarda `clientOrgId`: sirve para el tenant completo (OPS_ADMIN) y para el alcance de la
    // organización cliente, pero no puede expresar la visibilidad de PRO/WORKER (ofertas, reservas, contratos).
    const visibility = jobVisibilityKind(input.roles);
    if (
      visibility !== "marketplace" &&
      isJobsBidsProjectionReadthroughEnabled() &&
      isJobsBidsProjectionEnabled(input.tenantId)
    ) {
      try {
        const [projectionRows, directCount] = await Promise.all([
          this.prisma.jobsBidsProjection.findMany({
            where: {
              tenantId: input.tenantId,
              ...(visibility === "own-org" ? { clientOrgId: input.orgId } : {}),
            },
            orderBy: { jobId: "desc" },
            take: 20,
            select: { snapshotJson: true },
          }),
          this.prisma.job.count({ where: jobsWhere }),
        ]);

        if (projectionRows.length >= Math.min(directCount, 20)) {
          const rows = projectionRows
            .map((row) => extractJobSummaryFromProjection(row.snapshotJson))
            .filter((row): row is JobSummaryRow => row !== null);
          if (rows.length === projectionRows.length) {
            return rows;
          }
        }
      } catch (error) {
        this.logger.warn(
          `[ctx] jobs projection read-through failed, falling back to direct query: ${String(error)}`,
        );
      }
    }

    return this.prisma.job.findMany({
      where: jobsWhere,
      orderBy: { id: "desc" }, take: 20,
      select: { id: true, title: true, status: true },
    }).catch(() => [] as JobSummaryRow[]);
  }

  formatContextBlock(ctx: SemseOperationalContext): string {
    const lines = [
      `## Contexto operativo SEMSE Project (modo=${ctx.mode})`,
      `Usuario: ${ctx.user.id} | Rol: ${ctx.user.role}`,
      ctx.activeProject
        ? `Proyecto activo: "${ctx.activeProject.title}" (${ctx.activeProject.status})`
        : "Sin proyecto activo seleccionado.",
      ctx.preferredProfessional
        ? `Profesional objetivo: ${ctx.preferredProfessional.displayName} | trust=${ctx.preferredProfessional.trustScore ?? "n/d"} | proyectos=${ctx.preferredProfessional.completedProjects ?? "n/d"}`
        : "Profesional objetivo: no definido.",
      `Trabajos: ${ctx.jobs.active} activos | ${ctx.jobs.waitingProposals} esperando | ${ctx.jobs.completed} completados`,
      `Hitos: ${ctx.milestones.active} activos | ${ctx.milestones.pendingApproval} pendientes de aprobación`,
      `Escrow: $${ctx.payments.escrowFunded.toLocaleString()} fondeado | $${ctx.payments.pendingRelease.toLocaleString()} elegibles para liberación`,
      `Evidencias: ${ctx.evidences.total} total | ${ctx.evidences.pendingReview} por revisar`,
      `Disputas: ${ctx.disputes.open} abiertas | ${ctx.disputes.urgent} urgentes`,
      `Notificaciones: ${ctx.notifications.length} sin leer`,
      `Preferencias: tono=${ctx.assistantSettings.assistantTone ?? "default"} | idioma=${ctx.assistantSettings.assistantLanguage ?? "default"} | verbosidad=${ctx.assistantSettings.assistantVerbosity ?? "default"} | expertMode=${ctx.assistantSettings.expertMode ? "on" : "off"}`,
      `Sistema: API=${ctx.systemHealth.api} | Worker=${ctx.systemHealth.worker} | Redis=${ctx.systemHealth.redis}`,
    ];

    if (ctx.finance) {
      const f = ctx.finance;
      lines.push(
        `## Finanzas del proyecto`,
        `Facturado: $${f.totalInvoiced.toLocaleString()} | Cobrado: $${f.totalPaid.toLocaleString()} | Por cobrar: $${f.totalPending.toLocaleString()} | ${f.invoiceCount} facturas`,
        `Gastos: $${f.totalExpenses.toLocaleString()} (${f.expenseCount} registros)`,
        f.margin !== null ? `Margen estimado: ${f.margin.toFixed(1)}%` : "",
        f.overdueCount > 0 ? `⚠ ${f.overdueCount} factura(s) VENCIDAS` : "",
        Object.keys(f.expensesByCategory).length > 0
          ? `Top gastos: ${Object.entries(f.expensesByCategory).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}=$${v.toLocaleString()}`).join(" · ")}`
          : "",
      );
    }

    if (ctx.ecosystem5d) {
      const eco = ctx.ecosystem5d;
      lines.push(
        `## Lente Ecosistema 5D (nivel proyecto/tenant — no es una métrica global del sistema)`,
        `Estado general: ${eco.status.toUpperCase()} (${eco.score}/100)`,
        ...eco.dimensions.slice(0, 5).map((dim) => `${dim.label}: ${dim.score}/100 (${dim.status}) — ${dim.summary}`),
        eco.alerts.length > 0
          ? `Alertas 5D: ${eco.alerts.slice(0, 3).map((alert) => `[${alert.dimension}] ${alert.message}`).join(" · ")}`
          : "",
      );
    }

    if (ctx.risk) {
      const r = ctx.risk;
      const emoji = { low: "🟢", medium: "🟡", high: "🟠", critical: "🔴" }[r.level] ?? "⚪";
      lines.push(
        `## Análisis de riesgo del proyecto`,
        `${emoji} Riesgo ${r.level.toUpperCase()}: score=${r.overallScore}/100`,
        `Disputa: ${(r.disputeRisk * 100).toFixed(0)}% | Presupuesto: ${(r.budgetOverrunRisk * 100).toFixed(0)}% | Agenda: ${(r.scheduleRisk * 100).toFixed(0)}%`,
        r.recommendations.length > 0 ? `Recomendaciones: ${r.recommendations.slice(0, 2).join(" · ")}` : "",
      );
    }

    return lines.filter(l => l !== "").join("\n");
  }

  private async resolvePreferredProfessionalContext(
    tenantId: string,
    jobId: string,
  ): Promise<PreferredProfessionalContextView> {
    const entry = await this.prisma.workspaceMemoryEntry.findFirst({
      where: {
        tenantId,
        workspaceId: `job:${jobId}`,
        kind: "decision",
        tags: { has: "preferred-professional" },
      },
      orderBy: { updatedAt: "desc" },
      select: { body: true },
    }).catch(() => null);

    if (!entry?.body) return null;

    try {
      const parsed = JSON.parse(entry.body) as {
        userId?: unknown;
        displayName?: unknown;
        publicSlug?: unknown;
        selectedAt?: unknown;
      };

      if (typeof parsed.userId !== "string" || typeof parsed.displayName !== "string") {
        return null;
      }

      const credential = await this.prisma.professionalCredential.findUnique({
        where: { userId: parsed.userId },
        select: {
          trustScore: true,
          completedProjects: true,
          specialties: true,
        },
      }).catch(() => null);

      const specialties = Array.isArray(credential?.specialties)
        ? (credential.specialties as unknown[]).filter((item: unknown): item is string => typeof item === "string")
        : [];

      return {
        userId: parsed.userId,
        displayName: parsed.displayName,
        publicSlug: typeof parsed.publicSlug === "string" ? parsed.publicSlug : null,
        selectedAt: typeof parsed.selectedAt === "string" ? parsed.selectedAt : null,
        trustScore: typeof credential?.trustScore === "number" ? credential.trustScore : null,
        completedProjects: typeof credential?.completedProjects === "number" ? credential.completedProjects : null,
        specialties,
      };
    } catch {
      return null;
    }
  }

  invalidateCache(userId: string, tenantId: string): void {
    this.invalidateScope({ tenantId, userId, source: "legacy.invalidateCache", reason: "user cache refresh" });
  }

  invalidateScope(input: ContextInvalidationInput): void {
    const scope: ContextInvalidationScope = input.projectId
      ? "project"
      : input.userId
        ? "user"
        : "tenant";

    let invalidatedKeys = 0;
    for (const key of this.cache.keys()) {
      if (!key.startsWith(`${input.tenantId}:`)) continue;

      const [, , keyUserId = "", , keyProjectId = ""] = key.split(":");
      const isProjectMatch = keyProjectId === (input.projectId ?? "") || keyProjectId === "none";
      const isUserMatch = keyUserId === (input.userId ?? "");

      if (
        scope === "tenant"
        || (scope === "project" && isProjectMatch)
        || (scope === "user" && isUserMatch)
      ) {
        this.cache.delete(key);
        invalidatedKeys++;
      }
    }

    void this.deleteSnapshots(input, scope);

    const payload = {
      tenantId: input.tenantId,
      projectId: input.projectId ?? null,
      userId: input.userId ?? null,
      scope,
      source: input.source,
      reason: input.reason ?? "context refresh",
      invalidatedKeys,
      ts: Date.now(),
    };

    this.sseBus?.emit(`context:${input.tenantId}:tenant`, "context-update", payload);
    if (input.projectId) {
      this.sseBus?.emit(`context:${input.tenantId}:project:${input.projectId}`, "context-update", payload);
    }
  }

  async getLatestSnapshot(input: {
    tenantId: string;
    userId: string;
    orgId?: string;
    roles?: string[];
    projectId?: string;
  }): Promise<SemseOperationalContext | null> {
    // Sin `orgId`/`roles` el actor es el más estrecho: sin org y sin OPS_ADMIN.
    const actorScope = this.scopeActor({
      tenantId: input.tenantId,
      orgId: input.orgId ?? "",
      userId: input.userId,
      role: input.roles?.[0] ?? "",
      roles: input.roles,
    });
    if (input.projectId) await this.assertProjectAccess(actorScope, input.projectId);

    const row = await this.prisma.operationalContextSnapshot.findFirst({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        ...(input.projectId ? { projectId: input.projectId } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: { snapshotJson: true, projectId: true },
    }).catch(() => null);

    if (!row || typeof row.snapshotJson !== "object" || row.snapshotJson === null) {
      return null;
    }

    const snapshot = row.snapshotJson as unknown as SemseOperationalContext;

    if (row.projectId) {
      // Un snapshot de proyecto no se devuelve si el actor ya no participa en él.
      try {
        const scope = await this.assertProjectAccess(actorScope, row.projectId);
        if (!hasScopeAccess(actorScope, scope, "client") || !hasPermission(actorScope.roles, "finance:read")) return { ...snapshot, finance: null };
      } catch (error) {
        if (error instanceof NotFoundException || error instanceof ForbiddenException) return null;
        throw error;
      }
      return snapshot;
    }

    // Snapshots sin proyecto guardados antes de acotar el lente 5D pueden traer agregados de todo el tenant
    // (5D, y finanzas/riesgo si los hubo): solo OPS_ADMIN los conserva.
    if (!isOpsAdmin(actorScope)) {
      return { ...snapshot, ecosystem5d: null, finance: null, risk: null };
    }
    return snapshot;
  }

  private async persistSnapshot(
    input: { tenantId: string; orgId: string; userId: string; role: string; projectId?: string },
    ctx: SemseOperationalContext,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + CONTEXT_TTL_SECONDS * 1000);
    await this.prisma.operationalContextSnapshot.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        projectId: input.projectId,
        role: input.role,
        snapshotJson: ctx as unknown as object,
        expiresAt,
      },
    }).catch((err: unknown) => {
      this.logger.warn(`[ctx] persist snapshot failed: ${String(err)}`);
    });
  }

  private async deleteSnapshots(input: ContextInvalidationInput, scope: ContextInvalidationScope): Promise<void> {
    const where =
      scope === "project" && input.projectId
        ? {
            tenantId: input.tenantId,
            OR: [
              { projectId: input.projectId },
              { projectId: null },
            ],
          }
        : scope === "user" && input.userId
          ? {
              tenantId: input.tenantId,
              userId: input.userId,
            }
          : {
              tenantId: input.tenantId,
            };

    await this.prisma.operationalContextSnapshot.deleteMany({ where }).catch((err: unknown) => {
      this.logger.warn(`[ctx] delete snapshots failed: ${String(err)}`);
    });
  }
}

function extractJobSummaryFromProjection(snapshotJson: unknown): JobSummaryRow | null {
  if (!snapshotJson || typeof snapshotJson !== "object") {
    return null;
  }
  const job = (snapshotJson as { job?: unknown }).job;
  if (!job || typeof job !== "object") {
    return null;
  }
  const { id, title, status } = job as Record<string, unknown>;
  if (typeof id !== "string" || typeof title !== "string" || typeof status !== "string") {
    return null;
  }
  return { id, title, status };
}
