import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export type RiskFactor = {
  name: string;
  value: number;
  weight: number;
  description: string;
};

export type RiskScoreResult = {
  projectId: string;
  overallScore: number;      // 0-100, higher = riskier
  level: "low" | "medium" | "high" | "critical";
  disputeRisk: number;       // 0.0 - 1.0
  budgetOverrunRisk: number;
  scheduleRisk: number;
  factors: RiskFactor[];
  recommendations: string[];
  calculatedAt: string;
};

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function toNum(v: unknown): number {
  return parseFloat(String(v ?? 0)) || 0;
}

function riskLevel(score: number): RiskScoreResult["level"] {
  if (score >= 70) return "critical";
  if (score >= 50) return "high";
  if (score >= 30) return "medium";
  return "low";
}

@Injectable()
export class RiskScoringService {
  private readonly logger = new Logger(RiskScoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  async calculateProjectRisk(tenantId: string, projectId: string): Promise<RiskScoreResult> {
    // Step 1: load project first so we can use its FKs in step 2
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { job: { select: { budgetMin: true, budgetMax: true, clientOrgId: true, title: true } } },
    });

    const clientOrgId = project?.job?.clientOrgId ?? "";
    const proOrgId = project?.assignedProOrgId ?? "";

    // Step 2: load everything else in parallel
    type MRow = { status: string; approvedAt: Date | null; amount: unknown; updatedAt: Date };
    type EvidRow = { validationStatus: string | null };
    type DRow = { status: string };
    type InvRow = { status: string; total: unknown };
    type ExpRow = { amount: unknown };
    type CHistRow = { id: string; status: string };

    const [milestones, evidences, disputes, escrow, invoices, expenses,
      clientHistory, contractorHistory] = await Promise.all([
      this.prisma.milestone.findMany({ where: { projectId }, select: { status: true, approvedAt: true, amount: true, updatedAt: true } }) as Promise<MRow[]>,
      this.prisma.evidence.findMany({ where: { projectId }, select: { validationStatus: true } }) as Promise<EvidRow[]>,
      this.prisma.dispute.findMany({ where: { projectId }, select: { status: true } }) as Promise<DRow[]>,
      this.prisma.paymentEscrow.findUnique({ where: { projectId }, select: { totalAmount: true, status: true } }),
      this.prisma.invoice.findMany({ where: { projectId }, select: { status: true, total: true } }) as Promise<InvRow[]>,
      this.prisma.projectExpense.findMany({ where: { projectId, status: { not: "rejected" } }, select: { amount: true } }) as Promise<ExpRow[]>,
      this.prisma.dispute.count({ where: { project: { job: { clientOrgId } } } }).catch(() => 0),
      this.prisma.project.findMany({ where: { tenantId, assignedProOrgId: proOrgId }, select: { id: true, status: true }, take: 20 }).catch(() => [] as CHistRow[]) as Promise<CHistRow[]>,
    ]);

    const factors: RiskFactor[] = [];

    // ── Dispute risk signals ──────────────────────────────────────────────────
    const openDisputes = disputes.filter((d: DRow) => ["OPEN", "ASSIGNED", "UNDER_REVIEW"].includes(d.status)).length;
    const clientDisputeRate = Math.min(1, clientHistory / 10);

    factors.push({
      name: "Disputas activas en este proyecto",
      value: clamp(openDisputes * 0.4),
      weight: 0.35,
      description: openDisputes > 0 ? `${openDisputes} disputa(s) abierta(s)` : "Sin disputas",
    });
    factors.push({
      name: "Historial de disputas del cliente",
      value: clamp(clientDisputeRate),
      weight: 0.25,
      description: `${clientHistory} disputa(s) en historial del cliente`,
    });

    // Evidence completeness
    const totalEvidence = evidences.length;
    const pendingEvidence = evidences.filter((e: EvidRow) => e.validationStatus === "pending").length;
    const rejectedEvidence = evidences.filter((e: EvidRow) => e.validationStatus === "failed").length;
    const evidenceRisk = totalEvidence === 0 ? 0.3 : clamp((pendingEvidence + rejectedEvidence * 2) / Math.max(1, totalEvidence) * 0.5);
    factors.push({
      name: "Evidencia pendiente de revisión",
      value: evidenceRisk,
      weight: 0.2,
      description: `${pendingEvidence} pendientes, ${rejectedEvidence} rechazadas de ${totalEvidence} total`,
    });

    const disputeRisk = clamp(
      factors.reduce((s, f) => s + f.value * f.weight, 0) / factors.slice(0, 3).reduce((s, f) => s + f.weight, 0)
    );

    // ── Budget overrun risk signals ───────────────────────────────────────────
    const budgetFactors: RiskFactor[] = [];

    const budget = toNum(project?.job?.budgetMax ?? project?.job?.budgetMin);
    const escrowFunded = toNum(escrow?.totalAmount);
    const invoiceTotal = invoices.reduce((s: number, i: InvRow) => s + toNum(i.total), 0);
    const expenseTotal = expenses.reduce((s: number, e: ExpRow) => s + toNum(e.amount), 0);
    const reference = Math.max(budget, escrowFunded, 1);

    const expenseRatio = clamp(expenseTotal / reference);
    const invoiceOverBudget = budget > 0 ? clamp((invoiceTotal - budget) / budget * 2) : 0;

    budgetFactors.push({
      name: "Ratio gastos vs presupuesto",
      value: expenseRatio,
      weight: 0.5,
      description: `$${expenseTotal.toLocaleString()} gastado de $${reference.toLocaleString()} presupuestado`,
    });
    budgetFactors.push({
      name: "Facturación sobre presupuesto",
      value: invoiceOverBudget,
      weight: 0.5,
      description: invoiceOverBudget > 0 ? `${(invoiceOverBudget * 50).toFixed(0)}% sobre presupuesto` : "Dentro del presupuesto",
    });

    const budgetOverrunRisk = clamp(
      budgetFactors.reduce((s, f) => s + f.value * f.weight, 0)
    );

    factors.push(...budgetFactors.map(f => ({ ...f, weight: f.weight * 0.4 })));

    // ── Schedule risk signals ─────────────────────────────────────────────────
    const scheduleFactors: RiskFactor[] = [];

    const now = new Date();
    // Milestones stale > 14 days without approval (proxy for "late" since no dueAt field)
    const staleThreshold = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const lateMilestones = milestones.filter((m: MRow) =>
      !["APPROVED", "COMPLETED"].includes(m.status) &&
      m.updatedAt && new Date(m.updatedAt) < staleThreshold
    ).length;
    const pendingMilestones = milestones.filter((m: MRow) => ["DRAFT", "SUBMITTED", "AWAITING_REVIEW"].includes(m.status)).length;

    const contractorProjectCount = contractorHistory.length;
    const contractorSuccessRate = contractorProjectCount > 0
      ? contractorHistory.filter((p: { status: string }) => p.status === "CLOSED").length / contractorProjectCount
      : 0.8;

    scheduleFactors.push({
      name: "Hitos vencidos",
      value: clamp(lateMilestones * 0.25),
      weight: 0.5,
      description: `${lateMilestones} hito(s) vencidos sin aprobar`,
    });
    scheduleFactors.push({
      name: "Historial del contratista",
      value: clamp(1 - contractorSuccessRate),
      weight: 0.3,
      description: `${Math.round(contractorSuccessRate * 100)}% tasa de éxito (${contractorProjectCount} proyectos)`,
    });
    scheduleFactors.push({
      name: "Hitos pendientes",
      value: clamp(pendingMilestones * 0.1),
      weight: 0.2,
      description: `${pendingMilestones} hito(s) activos por completar`,
    });

    const scheduleRisk = clamp(
      scheduleFactors.reduce((s, f) => s + f.value * f.weight, 0)
    );

    factors.push(...scheduleFactors.map(f => ({ ...f, weight: f.weight * 0.3 })));

    // ── Overall score ─────────────────────────────────────────────────────────
    const overallScore = Math.round(
      disputeRisk * 0.40 * 100 +
      budgetOverrunRisk * 0.35 * 100 +
      scheduleRisk * 0.25 * 100
    );

    // ── Recommendations ───────────────────────────────────────────────────────
    const recommendations: string[] = [];
    if (openDisputes > 0) recommendations.push(`Resolver ${openDisputes} disputa(s) activa(s) antes de continuar pagos`);
    if (lateMilestones > 0) recommendations.push(`${lateMilestones} hito(s) vencido(s) — coordinar con el profesional`);
    if (pendingEvidence > 2) recommendations.push(`Revisar ${pendingEvidence} evidencias pendientes para desbloquear pagos`);
    if (expenseRatio > 0.8) recommendations.push("Gastos superan el 80% del presupuesto — revisar proyección final");
    if (clientDisputeRate > 0.3) recommendations.push("Cliente con historial de disputas — documentar acuerdos con detalle");
    if (recommendations.length === 0) recommendations.push("Sin alertas activas — proyecto dentro de parámetros normales");

    // Persist score
    await this.prisma.projectRiskScore.upsert({
      where: { projectId },
      create: {
        tenantId, projectId,
        overallScore,
        disputeRisk, budgetOverrunRisk, scheduleRisk,
        factorsJson: factors,
      },
      update: {
        overallScore, disputeRisk, budgetOverrunRisk, scheduleRisk,
        factorsJson: factors,
      },
    });

    this.logger.log(`[risk] project=${projectId} score=${overallScore} level=${riskLevel(overallScore)}`);

    return {
      projectId, overallScore,
      level: riskLevel(overallScore),
      disputeRisk, budgetOverrunRisk, scheduleRisk,
      factors, recommendations,
      calculatedAt: new Date().toISOString(),
    };
  }

  async listHighRiskProjects(tenantId: string, minScore = 50): Promise<Array<{ projectId: string; overallScore: number; level: string }>> {
    const rows = await this.prisma.projectRiskScore.findMany({
      where: { tenantId, overallScore: { gte: minScore } },
      orderBy: { overallScore: "desc" },
      take: 20,
    });
    return rows.map((r: { projectId: string; overallScore: number }) => ({
      projectId: r.projectId,
      overallScore: r.overallScore,
      level: riskLevel(r.overallScore),
    }));
  }
}
