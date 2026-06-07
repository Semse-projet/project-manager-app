import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { HealthService } from "../health/health.service.js";
import { RiskScoringService } from "./risk-scoring.service.js";

export type Ecosystem5DStatus = "strong" | "stable" | "watch" | "critical";
export type Ecosystem5DDimensionKey = "execution" | "finance" | "evidence" | "trust" | "operations";

export type Ecosystem5DSignal = {
  label: string;
  value: string;
  impact: "positive" | "neutral" | "negative";
};

export type Ecosystem5DDimension = {
  key: Ecosystem5DDimensionKey;
  label: string;
  score: number;
  status: Ecosystem5DStatus;
  summary: string;
  signals: Ecosystem5DSignal[];
};

export type Ecosystem5DAlert = {
  level: "critical" | "high" | "medium" | "info";
  dimension: Ecosystem5DDimensionKey;
  message: string;
  action: string;
};

export type Ecosystem5DView = {
  scope: "tenant" | "project";
  tenantId: string;
  projectId: string | null;
  score: number;
  status: Ecosystem5DStatus;
  dimensions: Ecosystem5DDimension[];
  alerts: Ecosystem5DAlert[];
  generatedAt: string;
};

type ProjectRow = {
  id: string;
  tenantId: string;
  status: string;
  updatedAt: Date;
  assignedProOrgId: string;
};

type MilestoneRow = { status: string; updatedAt: Date };
type EvidenceRow = { validationStatus: string | null };
type DisputeRow = { status: string };
type InvoiceRow = { status: string; total: unknown };
type ExpenseRow = { status: string; amount: unknown; isDuplicate: boolean };
type EscrowRow = {
  totalAmount: unknown;
  transactions: Array<{ type: string; amount: unknown; status: string }>;
};
type CredentialRow = {
  trustScore: number;
  disputeRate: unknown;
  verifiedAt: Date | null;
};
type DelegationRow = { status: string };
type RiskRow = { overallScore: number };

const ACTIVE_PROJECT_STATUSES = new Set(["open", "in_progress", "blocked"]);
const OPEN_DISPUTE_STATUSES = new Set(["OPEN", "ASSIGNED", "UNDER_REVIEW"]);
const PENDING_MILESTONE_STATUSES = new Set(["DRAFT", "SUBMITTED", "AWAITING_REVIEW"]);

function clamp(n: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, n));
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toNum(v: unknown): number {
  return parseFloat(String(v ?? 0)) || 0;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function daysSince(date: Date | string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

function statusForScore(score: number): Ecosystem5DStatus {
  if (score >= 80) return "strong";
  if (score >= 60) return "stable";
  if (score >= 40) return "watch";
  return "critical";
}

function impactForDelta(delta: number): Ecosystem5DSignal["impact"] {
  if (delta > 0) return "positive";
  if (delta < 0) return "negative";
  return "neutral";
}

function statusWeight(status: Ecosystem5DStatus): number {
  return { strong: 0, stable: 1, watch: 2, critical: 3 }[status];
}

@Injectable()
export class Ecosystem5DService {
  private readonly logger = new Logger(Ecosystem5DService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly riskService: RiskScoringService,
    @Optional() private readonly healthService?: HealthService,
  ) {}

  async buildView(input: { tenantId: string; projectId?: string }): Promise<Ecosystem5DView> {
    if (input.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { id: true, tenantId: true, status: true, updatedAt: true, assignedProOrgId: true },
      });

      if (project && project.tenantId === input.tenantId) {
        return this.buildProjectView(input.tenantId, project);
      }
    }

    return this.buildTenantView(input.tenantId);
  }

  private async buildTenantView(tenantId: string): Promise<Ecosystem5DView> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      projects,
      milestones,
      evidences,
      disputes,
      invoices,
      expenses,
      escrows,
      credentials,
      delegations,
      riskRows,
    ] = await Promise.all([
      this.prisma.project.findMany({
        where: { tenantId },
        select: { id: true, tenantId: true, status: true, updatedAt: true, assignedProOrgId: true },
      }) as Promise<ProjectRow[]>,
      this.prisma.milestone.findMany({
        where: { project: { tenantId } },
        select: { status: true, updatedAt: true },
      }) as Promise<MilestoneRow[]>,
      this.prisma.evidence.findMany({
        where: { project: { tenantId } },
        select: { validationStatus: true },
      }) as Promise<EvidenceRow[]>,
      this.prisma.dispute.findMany({
        where: { tenantId },
        select: { status: true },
      }) as Promise<DisputeRow[]>,
      this.prisma.invoice.findMany({
        where: { tenantId },
        select: { status: true, total: true },
      }) as Promise<InvoiceRow[]>,
      this.prisma.projectExpense.findMany({
        where: { tenantId },
        select: { status: true, amount: true, isDuplicate: true },
      }) as Promise<ExpenseRow[]>,
      this.prisma.paymentEscrow.findMany({
        where: { project: { tenantId } },
        select: {
          totalAmount: true,
          transactions: { select: { type: true, amount: true, status: true } },
        },
      }) as Promise<EscrowRow[]>,
      this.prisma.professionalCredential.findMany({
        where: { tenantId },
        select: { trustScore: true, disputeRate: true, verifiedAt: true },
      }) as Promise<CredentialRow[]>,
      this.prisma.agentDelegation.findMany({
        where: { tenantId, createdAt: { gte: sevenDaysAgo } },
        select: { status: true },
      }) as Promise<DelegationRow[]>,
      this.prisma.projectRiskScore.findMany({
        where: { tenantId },
        select: { overallScore: true },
      }) as Promise<RiskRow[]>,
    ]);

    const activeProjects = projects.filter((p) => ACTIVE_PROJECT_STATUSES.has(p.status));
    const completedProjects = projects.filter((p) => p.status === "completed").length;
    const blockedProjects = projects.filter((p) => p.status === "blocked").length;
    const staleProjects = activeProjects.filter((p) => daysSince(p.updatedAt) > 14).length;
    const pendingMilestones = milestones.filter((m) => PENDING_MILESTONE_STATUSES.has(m.status)).length;
    const pendingEvidence = evidences.filter((e) => e.validationStatus === "pending").length;
    const failedEvidence = evidences.filter((e) => e.validationStatus === "failed").length;
    const manualEvidence = evidences.filter((e) => e.validationStatus === "manual_review").length;
    const openDisputes = disputes.filter((d) => OPEN_DISPUTE_STATUSES.has(d.status)).length;

    const totalInvoiced = invoices.reduce((sum, inv) => sum + toNum(inv.total), 0);
    const overdueInvoices = invoices.filter((inv) => inv.status === "overdue").length;
    const pendingInvoiceTotal = invoices
      .filter((inv) => ["sent", "viewed", "approved", "overdue"].includes(inv.status))
      .reduce((sum, inv) => sum + toNum(inv.total), 0);
    const activeExpenses = expenses.filter((exp) => exp.status !== "rejected" && exp.status !== "archived");
    const totalExpenses = activeExpenses.reduce((sum, exp) => sum + toNum(exp.amount), 0);
    const duplicateExpenses = activeExpenses.filter((exp) => exp.isDuplicate).length;

    const escrowFunded = escrows.reduce((sum, escrow) => sum + toNum(escrow.totalAmount), 0);
    const escrowReleased = escrows
      .flatMap((escrow) => escrow.transactions)
      .filter((txn) => txn.type === "RELEASE" && txn.status === "COMPLETED")
      .reduce((sum, txn) => sum + toNum(txn.amount), 0);
    const pendingRelease = Math.max(0, escrowFunded - escrowReleased);
    const margin = totalInvoiced > 0 ? ((totalInvoiced - totalExpenses) / totalInvoiced) * 100 : null;

    const avgTrustScore = credentials.length > 0
      ? credentials.reduce((sum, cred) => sum + cred.trustScore, 0) / credentials.length
      : 55;
    const verifiedCoverage = ratio(credentials.filter((cred) => !!cred.verifiedAt).length, Math.max(1, credentials.length));
    const avgDisputeRate = credentials.length > 0
      ? credentials.reduce((sum, cred) => sum + toNum(cred.disputeRate), 0) / credentials.length
      : 0.2;

    const failedDelegations = delegations.filter((d) => d.status === "failed").length;
    const pendingDelegations = delegations.filter((d) => d.status === "pending").length;
    const executingDelegations = delegations.filter((d) => d.status === "executing").length;
    const health = this.healthService?.getHealth() ?? {
      api: "ok" as const,
      worker: "ok" as const,
      redis: "ok" as const,
      checkedAt: new Date().toISOString(),
    };
    const highRiskProjects = riskRows.filter((row) => row.overallScore >= 50).length;

    const executionScore = clampScore(
      100
      - ratio(pendingMilestones, Math.max(1, milestones.length)) * 38
      - ratio(staleProjects, Math.max(1, activeProjects.length)) * 30
      - ratio(blockedProjects, Math.max(1, activeProjects.length)) * 22
      - ratio(highRiskProjects, Math.max(1, activeProjects.length)) * 12
      + Math.min(12, completedProjects * 2)
    );

    const financeScore = clampScore(
      100
      - ratio(overdueInvoices, Math.max(1, invoices.length)) * 32
      - ratio(pendingInvoiceTotal, Math.max(1, totalInvoiced || 1)) * 28
      - ratio(duplicateExpenses, Math.max(1, activeExpenses.length)) * 18
      - (margin === null ? 0 : margin < 0 ? 25 : margin < 10 ? 15 : margin < 20 ? 7 : 0)
      - ratio(openDisputes > 0 ? pendingRelease : 0, Math.max(1, escrowFunded || 1)) * 15
    );

    const evidenceScore = clampScore(
      100
      - ratio(pendingEvidence, Math.max(1, evidences.length || activeProjects.length)) * 45
      - ratio(failedEvidence, Math.max(1, evidences.length || activeProjects.length)) * 35
      - ratio(manualEvidence, Math.max(1, evidences.length || activeProjects.length)) * 15
      - (evidences.length === 0 && activeProjects.length > 0 ? 18 : 0)
    );

    const trustScore = clampScore(
      avgTrustScore * 0.5
      + verifiedCoverage * 100 * 0.2
      + (1 - clamp(ratio(openDisputes, Math.max(1, activeProjects.length)))) * 100 * 0.2
      + (1 - clamp(avgDisputeRate)) * 100 * 0.1
      - (credentials.length === 0 ? 10 : 0)
    );

    const healthBase =
      (health.api === "ok" ? 34 : 12) +
      (health.worker === "ok" ? 33 : 8) +
      (health.redis === "ok" ? 33 : 8);
    const operationsScore = clampScore(
      healthBase
      - ratio(failedDelegations, Math.max(1, delegations.length)) * 25
      - Math.max(0, ratio(pendingDelegations + executingDelegations, Math.max(1, delegations.length)) - 0.5) * 20
    );

    const dimensions: Ecosystem5DDimension[] = [
      {
        key: "execution",
        label: "Execution",
        score: executionScore,
        status: statusForScore(executionScore),
        summary: staleProjects > 0
          ? `${staleProjects} proyecto(s) activos llevan más de 14 días sin pulso claro`
          : pendingMilestones > 0
            ? `${pendingMilestones} hito(s) siguen en cola de ejecución`
            : "La entrega se está moviendo sin bloqueos relevantes",
        signals: [
          { label: "Activos", value: String(activeProjects.length), impact: impactForDelta(activeProjects.length > 0 ? 1 : 0) },
          { label: "Estancados", value: String(staleProjects), impact: impactForDelta(staleProjects > 0 ? -1 : 0) },
          { label: "Pendientes", value: String(pendingMilestones), impact: impactForDelta(pendingMilestones > 3 ? -1 : 0) },
        ],
      },
      {
        key: "finance",
        label: "Finance",
        score: financeScore,
        status: statusForScore(financeScore),
        summary: overdueInvoices > 0
          ? `${overdueInvoices} factura(s) vencida(s) presionan la cobranza`
          : margin !== null && margin < 10
            ? `Margen comprimido (${margin.toFixed(1)}%) en el flujo actual`
            : "Facturación, gasto y liberación de fondos en rango razonable",
        signals: [
          { label: "Vencidas", value: String(overdueInvoices), impact: impactForDelta(overdueInvoices > 0 ? -1 : 0) },
          { label: "Por cobrar", value: `$${Math.round(pendingInvoiceTotal).toLocaleString()}`, impact: impactForDelta(pendingInvoiceTotal > 0 ? -1 : 0) },
          { label: "Margen", value: margin !== null ? `${margin.toFixed(1)}%` : "—", impact: impactForDelta(margin !== null && margin >= 20 ? 1 : margin !== null && margin < 10 ? -1 : 0) },
        ],
      },
      {
        key: "evidence",
        label: "Evidence",
        score: evidenceScore,
        status: statusForScore(evidenceScore),
        summary: failedEvidence > 0
          ? `${failedEvidence} evidencia(s) ya fallaron validación`
          : pendingEvidence > 0
            ? `${pendingEvidence} evidencia(s) siguen esperando revisión`
            : "La evidencia disponible está mayormente curada",
        signals: [
          { label: "Pendientes", value: String(pendingEvidence), impact: impactForDelta(pendingEvidence > 0 ? -1 : 0) },
          { label: "Fallidas", value: String(failedEvidence), impact: impactForDelta(failedEvidence > 0 ? -1 : 0) },
          { label: "Total", value: String(evidences.length), impact: impactForDelta(evidences.length > 0 ? 1 : 0) },
        ],
      },
      {
        key: "trust",
        label: "Trust",
        score: trustScore,
        status: statusForScore(trustScore),
        summary: openDisputes > 0
          ? `${openDisputes} disputa(s) activas erosionan la confianza operativa`
          : verifiedCoverage < 0.5
            ? "La cobertura de credenciales verificadas sigue baja"
            : "La capa reputacional del ecosistema está consistente",
        signals: [
          { label: "Trust prom.", value: `${Math.round(avgTrustScore)}/100`, impact: impactForDelta(avgTrustScore >= 70 ? 1 : avgTrustScore < 50 ? -1 : 0) },
          { label: "Verificados", value: `${Math.round(verifiedCoverage * 100)}%`, impact: impactForDelta(verifiedCoverage >= 0.6 ? 1 : verifiedCoverage < 0.3 ? -1 : 0) },
          { label: "Disputas", value: String(openDisputes), impact: impactForDelta(openDisputes > 0 ? -1 : 0) },
        ],
      },
      {
        key: "operations",
        label: "Operations",
        score: operationsScore,
        status: statusForScore(operationsScore),
        summary: failedDelegations > 0
          ? `${failedDelegations} delegación(es) multiagente fallaron en los últimos 7 días`
          : health.api !== "ok" || health.worker !== "ok" || health.redis !== "ok"
            ? "Infraestructura degradada — revisar worker o Redis"
            : "Infraestructura y orquestación respondiendo dentro de parámetros",
        signals: [
          { label: "API/Worker/Redis", value: `${health.api}/${health.worker}/${health.redis}`, impact: impactForDelta(health.api === "ok" && health.worker === "ok" && health.redis === "ok" ? 1 : -1) },
          { label: "Fallidas", value: String(failedDelegations), impact: impactForDelta(failedDelegations > 0 ? -1 : 0) },
          { label: "Backlog", value: String(pendingDelegations + executingDelegations), impact: impactForDelta(pendingDelegations + executingDelegations > 5 ? -1 : 0) },
        ],
      },
    ];

    const view = this.finalizeView({
      scope: "tenant",
      tenantId,
      projectId: null,
      dimensions,
      alerts: [
        ...(overdueInvoices > 0 ? [{ level: "high" as const, dimension: "finance" as const, message: `${overdueInvoices} factura(s) vencida(s) en el tenant`, action: "Acelerar cobranza y revisar bloqueos por proyecto" }] : []),
        ...(staleProjects > 0 ? [{ level: staleProjects > 2 ? "high" as const : "medium" as const, dimension: "execution" as const, message: `${staleProjects} proyecto(s) sin actividad reciente`, action: "Revisar hitos y reasignar seguimiento" }] : []),
        ...(openDisputes > 0 ? [{ level: openDisputes > 1 ? "critical" as const : "high" as const, dimension: "trust" as const, message: `${openDisputes} disputa(s) abiertas afectan la confianza`, action: "Coordinar resolución y documentar evidencia" }] : []),
        ...(failedDelegations > 0 ? [{ level: "medium" as const, dimension: "operations" as const, message: `${failedDelegations} delegación(es) multiagente fallaron esta semana`, action: "Auditar orquestación y retries" }] : []),
      ],
    });

    this.logger.log(`[5d] tenant=${tenantId} scope=tenant score=${view.score} status=${view.status}`);
    return view;
  }

  private async buildProjectView(tenantId: string, project: ProjectRow): Promise<Ecosystem5DView> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      milestones,
      evidences,
      disputes,
      invoices,
      expenses,
      escrow,
      credentials,
      delegations,
      risk,
    ] = await Promise.all([
      this.prisma.milestone.findMany({
        where: { projectId: project.id },
        select: { status: true, updatedAt: true },
      }) as Promise<MilestoneRow[]>,
      this.prisma.evidence.findMany({
        where: { projectId: project.id },
        select: { validationStatus: true },
      }) as Promise<EvidenceRow[]>,
      this.prisma.dispute.findMany({
        where: { projectId: project.id },
        select: { status: true },
      }) as Promise<DisputeRow[]>,
      this.prisma.invoice.findMany({
        where: { tenantId, projectId: project.id },
        select: { status: true, total: true },
      }) as Promise<InvoiceRow[]>,
      this.prisma.projectExpense.findMany({
        where: { tenantId, projectId: project.id },
        select: { status: true, amount: true, isDuplicate: true },
      }) as Promise<ExpenseRow[]>,
      this.prisma.paymentEscrow.findUnique({
        where: { projectId: project.id },
        select: {
          totalAmount: true,
          transactions: { select: { type: true, amount: true, status: true } },
        },
      }) as Promise<EscrowRow | null>,
      this.prisma.professionalCredential.findMany({
        where: { tenantId, orgId: project.assignedProOrgId },
        select: { trustScore: true, disputeRate: true, verifiedAt: true },
      }) as Promise<CredentialRow[]>,
      this.prisma.agentDelegation.findMany({
        where: { tenantId, projectId: project.id, createdAt: { gte: sevenDaysAgo } },
        select: { status: true },
      }) as Promise<DelegationRow[]>,
      this.riskService.calculateProjectRisk(tenantId, project.id),
    ]);

    const pendingMilestones = milestones.filter((m) => PENDING_MILESTONE_STATUSES.has(m.status)).length;
    const staleMilestones = milestones.filter((m) => PENDING_MILESTONE_STATUSES.has(m.status) && daysSince(m.updatedAt) > 10).length;
    const pendingEvidence = evidences.filter((e) => e.validationStatus === "pending").length;
    const failedEvidence = evidences.filter((e) => e.validationStatus === "failed").length;
    const manualEvidence = evidences.filter((e) => e.validationStatus === "manual_review").length;
    const openDisputes = disputes.filter((d) => OPEN_DISPUTE_STATUSES.has(d.status)).length;

    const totalInvoiced = invoices.reduce((sum, inv) => sum + toNum(inv.total), 0);
    const overdueInvoices = invoices.filter((inv) => inv.status === "overdue").length;
    const pendingInvoiceTotal = invoices
      .filter((inv) => ["sent", "viewed", "approved", "overdue"].includes(inv.status))
      .reduce((sum, inv) => sum + toNum(inv.total), 0);
    const activeExpenses = expenses.filter((exp) => exp.status !== "rejected" && exp.status !== "archived");
    const totalExpenses = activeExpenses.reduce((sum, exp) => sum + toNum(exp.amount), 0);
    const duplicateExpenses = activeExpenses.filter((exp) => exp.isDuplicate).length;
    const escrowFunded = toNum(escrow?.totalAmount);
    const escrowReleased = (escrow?.transactions ?? [])
      .filter((txn) => txn.type === "RELEASE" && txn.status === "COMPLETED")
      .reduce((sum, txn) => sum + toNum(txn.amount), 0);
    const pendingRelease = Math.max(0, escrowFunded - escrowReleased);
    const margin = totalInvoiced > 0 ? ((totalInvoiced - totalExpenses) / totalInvoiced) * 100 : null;

    const avgTrustScore = credentials.length > 0
      ? credentials.reduce((sum, cred) => sum + cred.trustScore, 0) / credentials.length
      : 55;
    const verifiedCoverage = ratio(credentials.filter((cred) => !!cred.verifiedAt).length, Math.max(1, credentials.length));
    const avgDisputeRate = credentials.length > 0
      ? credentials.reduce((sum, cred) => sum + toNum(cred.disputeRate), 0) / credentials.length
      : 0.2;

    const failedDelegations = delegations.filter((d) => d.status === "failed").length;
    const pendingDelegations = delegations.filter((d) => d.status === "pending").length;
    const executingDelegations = delegations.filter((d) => d.status === "executing").length;
    const health = this.healthService?.getHealth() ?? {
      api: "ok" as const,
      worker: "ok" as const,
      redis: "ok" as const,
      checkedAt: new Date().toISOString(),
    };

    const executionScore = clampScore(
      100
      - risk.scheduleRisk * 45
      - ratio(pendingMilestones, Math.max(1, milestones.length)) * 25
      - ratio(staleMilestones, Math.max(1, milestones.length)) * 20
      - (project.status === "blocked" ? 15 : 0)
    );

    const financeScore = clampScore(
      100
      - risk.budgetOverrunRisk * 40
      - ratio(overdueInvoices, Math.max(1, invoices.length || 1)) * 25
      - ratio(pendingInvoiceTotal, Math.max(1, totalInvoiced || 1)) * 20
      - ratio(duplicateExpenses, Math.max(1, activeExpenses.length || 1)) * 15
      - (margin === null ? 0 : margin < 0 ? 20 : margin < 10 ? 12 : 0)
    );

    const evidenceScore = clampScore(
      100
      - ratio(pendingEvidence, Math.max(1, evidences.length || milestones.length || 1)) * 45
      - ratio(failedEvidence, Math.max(1, evidences.length || milestones.length || 1)) * 35
      - ratio(manualEvidence, Math.max(1, evidences.length || milestones.length || 1)) * 15
      - (evidences.length === 0 && milestones.length > 0 ? 18 : 0)
    );

    const trustScore = clampScore(
      avgTrustScore * 0.45
      + verifiedCoverage * 100 * 0.2
      + (1 - clamp(risk.disputeRisk)) * 100 * 0.25
      + (1 - clamp(avgDisputeRate)) * 100 * 0.1
      - (openDisputes > 0 ? 10 : 0)
    );

    const healthBase =
      (health.api === "ok" ? 34 : 12) +
      (health.worker === "ok" ? 33 : 8) +
      (health.redis === "ok" ? 33 : 8);
    const operationsScore = clampScore(
      healthBase
      - ratio(failedDelegations, Math.max(1, delegations.length || 1)) * 25
      - Math.max(0, ratio(pendingDelegations + executingDelegations, Math.max(1, delegations.length || 1)) - 0.5) * 20
      - (project.status === "blocked" ? 10 : 0)
    );

    const dimensions: Ecosystem5DDimension[] = [
      {
        key: "execution",
        label: "Execution",
        score: executionScore,
        status: statusForScore(executionScore),
        summary: staleMilestones > 0
          ? `${staleMilestones} hito(s) del proyecto ya muestran atraso operativo`
          : pendingMilestones > 0
            ? `${pendingMilestones} hito(s) siguen abiertos o pendientes`
            : "La ejecución del proyecto está bajo control",
        signals: [
          { label: "Riesgo agenda", value: `${Math.round(risk.scheduleRisk * 100)}%`, impact: impactForDelta(risk.scheduleRisk < 0.35 ? 1 : -1) },
          { label: "Pendientes", value: String(pendingMilestones), impact: impactForDelta(pendingMilestones > 0 ? -1 : 0) },
          { label: "Estancados", value: String(staleMilestones), impact: impactForDelta(staleMilestones > 0 ? -1 : 0) },
        ],
      },
      {
        key: "finance",
        label: "Finance",
        score: financeScore,
        status: statusForScore(financeScore),
        summary: overdueInvoices > 0
          ? `${overdueInvoices} factura(s) vencida(s) o con cobranza retrasada`
          : margin !== null && margin < 10
            ? `El margen del proyecto está bajo presión (${margin.toFixed(1)}%)`
            : "El flujo financiero del proyecto se mantiene razonable",
        signals: [
          { label: "Riesgo budget", value: `${Math.round(risk.budgetOverrunRisk * 100)}%`, impact: impactForDelta(risk.budgetOverrunRisk < 0.35 ? 1 : -1) },
          { label: "Por cobrar", value: `$${Math.round(pendingInvoiceTotal).toLocaleString()}`, impact: impactForDelta(pendingInvoiceTotal > 0 ? -1 : 0) },
          { label: "Margen", value: margin !== null ? `${margin.toFixed(1)}%` : "—", impact: impactForDelta(margin !== null && margin >= 20 ? 1 : margin !== null && margin < 10 ? -1 : 0) },
        ],
      },
      {
        key: "evidence",
        label: "Evidence",
        score: evidenceScore,
        status: statusForScore(evidenceScore),
        summary: failedEvidence > 0
          ? `${failedEvidence} evidencia(s) ya fueron rechazadas`
          : pendingEvidence > 0
            ? `${pendingEvidence} evidencia(s) siguen sin aprobación`
            : "La evidencia del proyecto está en buen estado",
        signals: [
          { label: "Pendientes", value: String(pendingEvidence), impact: impactForDelta(pendingEvidence > 0 ? -1 : 0) },
          { label: "Fallidas", value: String(failedEvidence), impact: impactForDelta(failedEvidence > 0 ? -1 : 0) },
          { label: "Total", value: String(evidences.length), impact: impactForDelta(evidences.length > 0 ? 1 : 0) },
        ],
      },
      {
        key: "trust",
        label: "Trust",
        score: trustScore,
        status: statusForScore(trustScore),
        summary: openDisputes > 0
          ? `${openDisputes} disputa(s) activas tensan la relación entre las partes`
          : verifiedCoverage < 0.5
            ? "La capa reputacional del contratista aún es débil"
            : "El proyecto conserva una base de confianza operativa aceptable",
        signals: [
          { label: "Trust org", value: `${Math.round(avgTrustScore)}/100`, impact: impactForDelta(avgTrustScore >= 70 ? 1 : avgTrustScore < 50 ? -1 : 0) },
          { label: "Verificado", value: `${Math.round(verifiedCoverage * 100)}%`, impact: impactForDelta(verifiedCoverage >= 0.6 ? 1 : verifiedCoverage < 0.3 ? -1 : 0) },
          { label: "Riesgo disputa", value: `${Math.round(risk.disputeRisk * 100)}%`, impact: impactForDelta(risk.disputeRisk < 0.35 ? 1 : -1) },
        ],
      },
      {
        key: "operations",
        label: "Operations",
        score: operationsScore,
        status: statusForScore(operationsScore),
        summary: failedDelegations > 0
          ? `${failedDelegations} automatización(es) del proyecto fallaron recientemente`
          : health.api !== "ok" || health.worker !== "ok" || health.redis !== "ok"
            ? "Infraestructura degradada: el proyecto puede sufrir fricción operativa"
            : "Infraestructura y automatización del proyecto responden bien",
        signals: [
          { label: "API/Worker/Redis", value: `${health.api}/${health.worker}/${health.redis}`, impact: impactForDelta(health.api === "ok" && health.worker === "ok" && health.redis === "ok" ? 1 : -1) },
          { label: "Fallidas", value: String(failedDelegations), impact: impactForDelta(failedDelegations > 0 ? -1 : 0) },
          { label: "Backlog", value: String(pendingDelegations + executingDelegations), impact: impactForDelta(pendingDelegations + executingDelegations > 3 ? -1 : 0) },
        ],
      },
    ];

    const view = this.finalizeView({
      scope: "project",
      tenantId,
      projectId: project.id,
      dimensions,
      alerts: [
        ...(overdueInvoices > 0 ? [{ level: "high" as const, dimension: "finance" as const, message: `${overdueInvoices} factura(s) vencida(s) dentro del proyecto`, action: "Revisar cobranza y próximos pagos" }] : []),
        ...(openDisputes > 0 ? [{ level: openDisputes > 1 ? "critical" as const : "high" as const, dimension: "trust" as const, message: `${openDisputes} disputa(s) activas bloquean confianza y flujo`, action: "Resolver disputa y consolidar evidencia" }] : []),
        ...(staleMilestones > 0 ? [{ level: "medium" as const, dimension: "execution" as const, message: `${staleMilestones} hito(s) muestran estancamiento`, action: "Reordenar hitos y destrabar approvals" }] : []),
        ...(failedDelegations > 0 ? [{ level: "medium" as const, dimension: "operations" as const, message: `${failedDelegations} delegación(es) de agentes fallaron en este proyecto`, action: "Inspeccionar orchestration y reintentos" }] : []),
      ],
    });

    this.logger.log(`[5d] tenant=${tenantId} project=${project.id} score=${view.score} status=${view.status}`);
    return view;
  }

  private finalizeView(input: {
    scope: "tenant" | "project";
    tenantId: string;
    projectId: string | null;
    dimensions: Ecosystem5DDimension[];
    alerts: Ecosystem5DAlert[];
  }): Ecosystem5DView {
    const score = clampScore(input.dimensions.reduce((sum, dim) => sum + dim.score, 0) / Math.max(1, input.dimensions.length));
    const topAlerts = input.alerts.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, info: 3 };
      return order[a.level] - order[b.level];
    }).slice(0, 6);

    const dims = [...input.dimensions].sort((a, b) => statusWeight(b.status) - statusWeight(a.status));

    return {
      scope: input.scope,
      tenantId: input.tenantId,
      projectId: input.projectId,
      score,
      status: statusForScore(score),
      dimensions: dims,
      alerts: topAlerts,
      generatedAt: new Date().toISOString(),
    };
  }
}
