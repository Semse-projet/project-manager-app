import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { PaymentGovernanceService } from "../payments/payment-governance.service.js";
import { BuildOpsService } from "../buildops/buildops.service.js";

export type OperationalRagContext = {
  project:            Record<string, unknown> | null;
  milestone:          Record<string, unknown> | null;
  paymentGovernance:  Record<string, unknown> | null;
  evidenceItems:      Record<string, unknown>[];
  evidenceHistory:    Record<string, unknown>[];
  changeOrders:       Record<string, unknown>[];
  operationalSignals: Record<string, unknown>[];
  missingSources:     string[];
};

function toPlain(obj: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
}

@Injectable()
export class OperationalRagContextService {
  private readonly logger = new Logger(OperationalRagContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly governance: PaymentGovernanceService,
    private readonly buildops: BuildOpsService,
  ) {}

  async build(input: {
    projectId:               string;
    tenantId:                string;
    milestoneId?:            string;
    evidenceItemId?:         string;
    changeOrderId?:          string;
    includeAuditTrail?:      boolean;
    includeOperationalSignals?: boolean;
  }): Promise<OperationalRagContext> {
    const missing: string[] = [];

    // 1. Project health
    let project: Record<string, unknown> | null = null;
    try {
      const ph = await this.buildops.getProjectHealth(input.tenantId, input.projectId);
      project = toPlain(ph);
    } catch { missing.push("buildops_project"); }

    // 2. Milestone
    let milestone: Record<string, unknown> | null = null;
    if (input.milestoneId) {
      const ms = await this.prisma.milestone.findFirst({
        where: { id: input.milestoneId, project: { tenantId: input.tenantId } },
        select: { id: true, title: true, status: true, paymentReadiness: true, evidenceReadiness: true, amount: true },
      });
      if (ms) milestone = toPlain(ms);
      else missing.push("milestone");
    }

    // 3. Payment governance
    let paymentGovernance: Record<string, unknown> | null = null;
    if (input.milestoneId) {
      try {
        const gov = await this.governance.evaluate(input.milestoneId, input.tenantId);
        paymentGovernance = toPlain(gov);
      } catch { missing.push("payment_governance"); }
    }

    // 4. Evidence items
    const evidenceItems: Record<string, unknown>[] = [];
    if (input.milestoneId) {
      const items = await this.prisma.milestoneEvidenceItem.findMany({
        where: { milestoneId: input.milestoneId },
        take: 20,
        select: { id: true, label: true, required: true, status: true, reviewNote: true, reviewedAt: true },
      });
      evidenceItems.push(...items.map(toPlain));
    } else if (input.evidenceItemId) {
      const item = await this.prisma.milestoneEvidenceItem.findUnique({
        where: { id: input.evidenceItemId },
        select: { id: true, label: true, required: true, status: true, reviewNote: true, reviewedAt: true },
      });
      if (item) evidenceItems.push(toPlain(item));
    }

    // 5. Evidence history (AuditLog)
    const evidenceHistory: Record<string, unknown>[] = [];
    if (input.includeAuditTrail !== false) {
      const entityIds = input.evidenceItemId ? [input.evidenceItemId]
        : evidenceItems.map((e) => e.id as string).slice(0, 5);

      if (entityIds.length > 0) {
        const logs = await this.prisma.auditLog.findMany({
          where: { entityType: "MilestoneEvidenceItem", entityId: { in: entityIds }, tenantId: input.tenantId },
          orderBy: { occurredAt: "desc" },
          take: 20,
          select: { id: true, action: true, beforeJson: true, afterJson: true, occurredAt: true, actor: { select: { email: true } } },
        });
        evidenceHistory.push(...logs.map(toPlain));
      }
    }

    // 6. Change orders
    const changeOrders: Record<string, unknown>[] = [];
    const coWhere = input.changeOrderId
      ? { tenantId: input.tenantId, id: input.changeOrderId }
      : { tenantId: input.tenantId, buildOpsProjectId: input.projectId, status: { in: ["predicted", "submitted", "approved", "changes_requested", "applied"] } };

    const cos = await this.prisma.changeOrderCandidate.findMany({
      where: coWhere,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, title: true, status: true, trigger: true, estimatedMin: true, estimatedMax: true, probability: true, milestoneId: true, clientNote: true },
    });
    changeOrders.push(...cos.map(toPlain));

    // 7. Operational signals
    const operationalSignals: Record<string, unknown>[] = [];
    if (input.includeOperationalSignals !== false) {
      const sigs = await this.prisma.operationalSignal.findMany({
        where: { tenantId: input.tenantId, buildOpsProjectId: input.projectId, status: "open" },
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
        take: 10,
        select: { id: true, type: true, severity: true, title: true, message: true, milestoneId: true, createdAt: true },
      });
      operationalSignals.push(...sigs.map(toPlain));
    }

    return { project, milestone, paymentGovernance, evidenceItems, evidenceHistory, changeOrders, operationalSignals, missingSources: missing };
  }

  /** Convert structured context to a readable prompt block for the LLM. */
  buildContextBlock(ctx: OperationalRagContext, locale: "es" | "en" = "es"): string {
    const isEs = locale === "es";
    const lines: string[] = [isEs ? "## Contexto Operacional SEMSE" : "## SEMSE Operational Context"];

    if (ctx.project) {
      lines.push(`\n**${isEs ? "Proyecto" : "Project"}:**`);
      lines.push(`- ID: ${ctx.project.projectId ?? ctx.project.id}`);
      lines.push(`- Status: ${ctx.project.status ?? "?"}`);
      lines.push(`- Riesgo: ${ctx.project.riskLevel ?? "?"}`);
      if (ctx.project.openSignals) lines.push(`- Señales abiertas: ${ctx.project.openSignals}`);
      if (ctx.project.openChangeCandidates) lines.push(`- Change orders pendientes: ${ctx.project.openChangeCandidates}`);
      if (ctx.project.nextBestAction) lines.push(`- NextBestAction: ${ctx.project.nextBestAction}`);
    }

    if (ctx.milestone) {
      lines.push(`\n**${isEs ? "Milestone" : "Milestone"}:**`);
      lines.push(`- Título: ${ctx.milestone.title}`);
      lines.push(`- Status: ${ctx.milestone.status}`);
      lines.push(`- Evidencia: ${ctx.milestone.evidenceReadiness}`);
      lines.push(`- Pago: ${ctx.milestone.paymentReadiness}`);
    }

    if (ctx.paymentGovernance) {
      const gov = ctx.paymentGovernance;
      lines.push(`\n**${isEs ? "Gobernanza de Pago" : "Payment Governance"}:**`);
      lines.push(`- canRelease: ${gov.canRelease}`);
      lines.push(`- releaseStatus: ${gov.releaseStatus}`);
      if (Array.isArray(gov.blockers) && gov.blockers.length > 0) lines.push(`- Bloqueadores: ${(gov.blockers as string[]).join("; ")}`);
      if (Array.isArray(gov.requiredActions) && gov.requiredActions.length > 0) lines.push(`- Acciones requeridas: ${(gov.requiredActions as string[]).join("; ")}`);
      if (gov.nextBestAction) lines.push(`- NextBestAction: ${gov.nextBestAction}`);
      if (gov.auditReason) lines.push(`- Razón auditada: ${gov.auditReason}`);
    }

    if (ctx.evidenceItems.length > 0) {
      lines.push(`\n**${isEs ? "Evidencia Requerida" : "Required Evidence"}:**`);
      ctx.evidenceItems.forEach((e) => {
        lines.push(`- [${e.status}] ${e.label}${e.required ? " (requerido)" : ""}`);
        if (e.reviewNote && typeof e.reviewNote === "string") {
          try {
            const n = JSON.parse(e.reviewNote) as Record<string, unknown>;
            const reason = (n.__agentReview as Record<string, unknown> | undefined)?.auditReason
              ?? (n.adminReview as Record<string, unknown> | undefined)?.reason;
            if (reason) lines.push(`  → Razón: ${reason}`);
          } catch { lines.push(`  → Nota: ${String(e.reviewNote).slice(0, 100)}`); }
        }
      });
    }

    if (ctx.evidenceHistory.length > 0) {
      lines.push(`\n**${isEs ? "Historial de Evidencia" : "Evidence History"}:**`);
      ctx.evidenceHistory.slice(0, 10).forEach((h) => {
        const after = (h.afterJson ?? {}) as Record<string, unknown>;
        const reason = after.replacedReason ?? after.archiveReason ?? after.reason;
        const prev = (h.beforeJson ?? {}) as Record<string, unknown>;
        lines.push(`- [${h.action}] ${prev.status ?? "?"} → ${after.status ?? "?"} (${String(h.occurredAt).slice(0, 10)})${reason ? ` — Razón: ${reason}` : ""}`);
      });
    }

    if (ctx.changeOrders.length > 0) {
      lines.push(`\n**${isEs ? "Change Orders" : "Change Orders"}:**`);
      ctx.changeOrders.forEach((co) => {
        const costMin = Number(co.estimatedMin ?? 0);
        const costMax = Number(co.estimatedMax ?? 0);
        const avg = costMin > 0 || costMax > 0 ? Math.round((costMin + costMax) / 2) : 0;
        lines.push(`- [${co.status}] ${co.title ?? co.trigger} — costDelta=$${avg} milestoneId=${co.milestoneId ?? "n/a"}`);
      });
    }

    if (ctx.operationalSignals.length > 0) {
      lines.push(`\n**${isEs ? "Señales Mission Control" : "Mission Control Signals"}:**`);
      ctx.operationalSignals.forEach((s) => {
        lines.push(`- [${s.severity}] ${s.title}: ${s.message}`);
      });
    }

    if (ctx.missingSources.length > 0) {
      lines.push(`\n**${isEs ? "Fuentes no disponibles" : "Missing sources"}:**`);
      lines.push(ctx.missingSources.join(", "));
    }

    return lines.join("\n");
  }

  /** Build citation list from context. */
  buildCitations(ctx: OperationalRagContext): Array<{ type: string; id: string; label: string; excerpt: string }> {
    const cits: Array<{ type: string; id: string; label: string; excerpt: string }> = [];

    if (ctx.paymentGovernance) {
      const gov = ctx.paymentGovernance;
      cits.push({
        type: "payment_governance", id: "governance",
        label: `Payment Governance — ${gov.releaseStatus ?? "?"}`,
        excerpt: `canRelease=${gov.canRelease} blockers=${JSON.stringify(gov.blockers ?? []).slice(0, 100)}`,
      });
    }

    if (ctx.milestone) {
      cits.push({
        type: "milestone", id: String(ctx.milestone.id ?? "ms"),
        label: `Milestone — ${ctx.milestone.title}`,
        excerpt: `status=${ctx.milestone.status} evidenceReadiness=${ctx.milestone.evidenceReadiness}`,
      });
    }

    ctx.evidenceItems.slice(0, 3).forEach((e) => {
      cits.push({ type: "evidence_item", id: String(e.id), label: String(e.label), excerpt: `status=${e.status}${e.reviewNote ? " — con nota de revisión" : ""}` });
    });

    ctx.evidenceHistory.slice(0, 3).forEach((h) => {
      cits.push({ type: "audit_log", id: String(h.id), label: `Historial — ${h.action}`, excerpt: `${String(h.occurredAt).slice(0, 10)}` });
    });

    ctx.changeOrders.slice(0, 3).forEach((co) => {
      cits.push({ type: "change_order", id: String(co.id), label: `Change Order — ${co.title ?? co.trigger}`, excerpt: `status=${co.status}` });
    });

    ctx.operationalSignals.slice(0, 2).forEach((s) => {
      cits.push({ type: "operational_signal", id: String(s.id), label: String(s.title), excerpt: `severity=${s.severity}` });
    });

    if (ctx.project) {
      cits.push({ type: "buildops_project", id: String(ctx.project.projectId ?? ctx.project.id ?? "prj"), label: "BuildOps Project Health", excerpt: `status=${ctx.project.status} riskLevel=${ctx.project.riskLevel}` });
    }

    return cits;
  }
}
