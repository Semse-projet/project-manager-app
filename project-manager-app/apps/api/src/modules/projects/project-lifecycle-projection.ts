import { createHash } from "node:crypto";
import type {
  ProjectCommercialStage,
  ProjectLifecycleProjection,
} from "@semse/schemas";

type Blocker = ProjectLifecycleProjection["blockers"][number];
type Environment = Record<string, string | undefined>;

export type LifecycleProjectionInput = {
  project: {
    id: string;
    tenantId: string;
    jobId: string;
    title: string;
    jobStatus: string;
    status: ProjectLifecycleProjection["project"]["executionStage"];
    ownerOrgId: string;
    startAt: Date | null;
    dueAt: Date | null;
    deadline: Date | null;
    acceptedBidCount: number;
    contract: {
      signedClientAt: Date | null;
      signedProAt: Date | null;
      updatedAt: Date;
    } | null;
    jobUpdatedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  };
  milestones: Array<{
    id: string;
    amount: number;
    status: string;
    updatedAt: Date;
    evidenceItems: Array<{
      id: string;
      required: boolean;
      status: string;
      updatedAt: Date;
    }>;
  }>;
  evidence: Array<{
    id: string;
    validationStatus: string;
    updatedAt: Date;
  }>;
  disputes: Array<{
    id: string;
    status: string;
    reason: string;
    updatedAt: Date;
  }>;
  escrow: {
    status: string;
    currency: string;
    updatedAt: Date;
    transactions: Array<{
      id: string;
      type: string;
      amount: number;
      status: string;
      createdAt: Date;
    }>;
  } | null;
  expenses: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    isDuplicate: boolean;
    updatedAt: Date;
  }>;
  risk: {
    overallScore: number;
    disputeRisk: number;
    budgetOverrunRisk: number;
    scheduleRisk: number;
    calculatedAt: Date;
    updatedAt: Date;
  } | null;
  now?: Date;
};

type LifecycleTransaction = NonNullable<
  LifecycleProjectionInput["escrow"]
>["transactions"][number];

const severityRank: Record<Blocker["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function isProjectLifecycleProjectionEnabled(
  tenantId: string,
  environment: Environment = process.env,
): boolean {
  if (environment.SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED !== "true") {
    return false;
  }

  const allowlist = parseAllowlist(environment.SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS);
  return allowlist.has("*") || allowlist.has(tenantId);
}

export function isProjectLifecyclePersistenceEnabled(
  environment: Environment = process.env,
): boolean {
  return environment.SEMSE_PROJECT_LIFECYCLE_PERSIST_ENABLED === "true";
}

export function buildProjectLifecycleProjection(
  input: LifecycleProjectionInput,
): ProjectLifecycleProjection {
  const now = input.now ?? new Date();
  const milestones = [...input.milestones].sort(byId);
  const evidence = [...input.evidence].sort(byId);
  const disputes = [...input.disputes].sort(byId);
  const expenses = [...input.expenses].sort(byId);
  const transactions = [...(input.escrow?.transactions ?? [])].sort(byId);
  const requiredEvidence = milestones
    .flatMap((milestone) => milestone.evidenceItems)
    .filter((item) => item.required)
    .sort(byId);

  const paid = milestones.filter((item) => item.status === "PAID").length;
  const completed = milestones.filter((item) => ["APPROVED", "PAID"].includes(item.status)).length;
  const awaitingReview = milestones.filter((item) =>
    ["SUBMITTED", "AWAITING_REVIEW"].includes(item.status),
  ).length;
  const pending = milestones.filter((item) => item.status === "DRAFT").length;
  const rejected = milestones.filter((item) => item.status === "REJECTED").length;
  const planned = money(milestones.reduce((sum, item) => sum + item.amount, 0));

  const evidenceSummary = evidence.reduce(
    (summary, item) => {
      summary.total += 1;
      if (item.validationStatus === "passed") summary.passed += 1;
      else if (item.validationStatus === "failed") summary.failed += 1;
      else summary.pending += 1;
      return summary;
    },
    {
      total: 0,
      passed: 0,
      pending: 0,
      failed: 0,
      missingRequired: requiredEvidence.filter((item) => item.status === "missing").length,
      rejectedRequired: requiredEvidence.filter((item) => item.status === "rejected").length,
    },
  );

  const successfulTransactions = transactions.filter((item) => item.status === "SUCCEEDED");
  const deposited = sumTransactions(successfulTransactions, "DEPOSIT");
  const released = sumTransactions(successfulTransactions, "RELEASE");
  const holdback = sumTransactions(successfulTransactions, "HOLDBACK");
  const fees = sumTransactions(successfulTransactions, "FEE");
  const refunded = sumTransactions(successfulTransactions, "REFUND");
  const available = money(deposited - released - holdback - fees - refunded);

  const expensesByCurrencyMap = new Map<string, number>();
  for (const expense of expenses) {
    if (expense.isDuplicate || !["approved", "reimbursed"].includes(expense.status.toLowerCase())) {
      continue;
    }
    expensesByCurrencyMap.set(
      expense.currency,
      money((expensesByCurrencyMap.get(expense.currency) ?? 0) + expense.amount),
    );
  }
  const expensesByCurrency = [...expensesByCurrencyMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => ({ currency, amount }));
  const currency =
    input.escrow?.currency ??
    (expensesByCurrency.length === 1 ? expensesByCurrency[0]?.currency ?? null : null);
  const actualExpenses = currency ? expensesByCurrencyMap.get(currency) ?? 0 : 0;
  const forecastAtCompletion = money(Math.max(planned, actualExpenses));

  const activeDisputes = disputes.filter((item) =>
    ["OPEN", "ASSIGNED", "UNDER_REVIEW"].includes(item.status),
  );
  const dueAt = input.project.dueAt ?? input.project.deadline;
  const blockers: Blocker[] = [];

  if (activeDisputes.length > 0) {
    addBlocker(blockers, {
      code: "active_dispute",
      severity: "critical",
      message: `${activeDisputes.length} disputa(s) activa(s) bloquean el avance`,
      owner: "ops",
      source: "dispute",
    });
  }
  if (input.project.status === "blocked") {
    addBlocker(blockers, {
      code: "project_blocked",
      severity: "critical",
      message: "El proyecto está marcado como bloqueado",
      owner: "ops",
      source: "project",
    });
  }
  if (
    dueAt &&
    dueAt.getTime() < now.getTime() &&
    !["completed", "cancelled"].includes(input.project.status)
  ) {
    addBlocker(blockers, {
      code: "overdue",
      severity: "high",
      message: "La fecha comprometida del proyecto ya venció",
      owner: "professional",
      source: "project",
    });
  }
  if (rejected > 0) {
    addBlocker(blockers, {
      code: "rejected_milestone",
      severity: "high",
      message: `${rejected} hito(s) rechazado(s) requieren cambios`,
      owner: "professional",
      source: "milestone",
    });
  }
  if (evidenceSummary.failed > 0) {
    addBlocker(blockers, {
      code: "failed_evidence",
      severity: "high",
      message: `${evidenceSummary.failed} evidencia(s) fallida(s) requieren reemplazo`,
      owner: "professional",
      source: "evidence",
    });
  }
  if (evidenceSummary.missingRequired > 0) {
    addBlocker(blockers, {
      code: "missing_required_evidence",
      severity: "high",
      message: `${evidenceSummary.missingRequired} evidencia(s) requerida(s) siguen faltando`,
      owner: "professional",
      source: "evidence",
    });
  }
  if (input.risk && input.risk.overallScore >= 80) {
    addBlocker(blockers, {
      code: "critical_risk",
      severity: "high",
      message: `El riesgo operativo alcanzó ${input.risk.overallScore}/100`,
      owner: "ops",
      source: "risk",
    });
  }
  if (milestones.length === 0 && input.project.status !== "cancelled") {
    addBlocker(blockers, {
      code: "missing_milestones",
      severity: "high",
      message: "El proyecto todavía no tiene hitos definidos",
      owner: "ops",
      source: "milestone",
    });
  }
  if (awaitingReview > 0) {
    addBlocker(blockers, {
      code: "pending_review",
      severity: "medium",
      message: `${awaitingReview} hito(s) esperan revisión`,
      owner: "client",
      source: "milestone",
    });
  }
  if (pending > 0) {
    addBlocker(blockers, {
      code: "draft_milestone",
      severity: "medium",
      message: `${pending} hito(s) todavía no se enviaron a revisión`,
      owner: "professional",
      source: "milestone",
    });
  }
  if (planned > 0 && actualExpenses > planned) {
    addBlocker(blockers, {
      code: "expense_overrun",
      severity: "medium",
      message: `Los gastos aprobados exceden el plan en ${formatAmount(actualExpenses - planned, currency)}`,
      owner: "ops",
      source: "expense",
    });
  }
  if (planned > deposited && milestones.length > 0 && input.project.status !== "cancelled") {
    addBlocker(blockers, {
      code: "funding_gap",
      severity: "medium",
      message: `Faltan ${formatAmount(planned - deposited, currency)} frente al plan de hitos`,
      owner: "client",
      source: "finance",
    });
  }
  if (milestones.some((item) => item.status === "APPROVED")) {
    addBlocker(blockers, {
      code: "approved_milestone",
      severity: "low",
      message: "Hay hitos aprobados pendientes de liberación",
      owner: "ops",
      source: "finance",
    });
  }
  if (holdback > 0) {
    addBlocker(blockers, {
      code: "payment_holdback",
      severity: "low",
      message: `${formatAmount(holdback, currency)} permanecen en holdback`,
      owner: "ops",
      source: "finance",
    });
  }

  blockers.sort((left, right) => severityRank[left.severity] - severityRank[right.severity]);
  const sourceUpdatedAt = latestDate([
    input.project.createdAt,
    input.project.updatedAt,
    input.project.jobUpdatedAt,
    input.project.contract?.updatedAt,
    ...milestones.map((item) => item.updatedAt),
    ...requiredEvidence.map((item) => item.updatedAt),
    ...evidence.map((item) => item.updatedAt),
    ...disputes.map((item) => item.updatedAt),
    input.escrow?.updatedAt,
    ...transactions.map((item) => item.createdAt),
    ...expenses.map((item) => item.updatedAt),
    input.risk?.updatedAt,
    input.risk?.calculatedAt,
  ]);
  const revision = `project-lifecycle.v1:${createHash("sha256")
    .update(stableStringify({
      schemaVersion: 1,
      project: input.project,
      milestones,
      evidence,
      disputes,
      escrow: input.escrow ? { ...input.escrow, transactions } : null,
      expenses,
      risk: input.risk,
    }))
    .digest("hex")}`;
  const missingSources = [
    ...(input.project.contract ? [] : ["contract"]),
    ...(input.escrow ? [] : ["escrow"]),
    ...(input.risk ? [] : ["risk"]),
    ...(planned > 0 && !currency ? ["currency"] : []),
  ];

  return {
    schemaVersion: 1,
    revision,
    generatedAt: now.toISOString(),
    sourceUpdatedAt: sourceUpdatedAt.toISOString(),
    project: {
      id: input.project.id,
      tenantId: input.project.tenantId,
      jobId: input.project.jobId,
      title: input.project.title,
      commercialStage: commercialStage(input),
      executionStage: input.project.status,
      ownerOrgId: input.project.ownerOrgId,
      startAt: input.project.startAt?.toISOString() ?? null,
      dueAt: dueAt?.toISOString() ?? null,
      createdAt: input.project.createdAt.toISOString(),
      updatedAt: input.project.updatedAt.toISOString(),
    },
    progress: {
      percentage: milestones.length === 0 ? 0 : Math.round((completed / milestones.length) * 100),
      milestones: {
        total: milestones.length,
        completed,
        paid,
        pending,
        awaitingReview,
        rejected,
      },
      evidence: evidenceSummary,
    },
    financial: {
      currency,
      planned,
      actualExpenses,
      forecastAtCompletion,
      forecastMethod: "max(planned,actual_expenses)",
      expensesByCurrency,
      deposited,
      released,
      holdback,
      fees,
      refunded,
      available,
      fundingGap: money(Math.max(0, planned - deposited)),
      unreleased: money(Math.max(0, planned - released - holdback)),
    },
    risk: input.risk
      ? {
          overallScore: input.risk.overallScore,
          level: riskLevel(input.risk.overallScore),
          disputeRisk: input.risk.disputeRisk,
          budgetOverrunRisk: input.risk.budgetOverrunRisk,
          scheduleRisk: input.risk.scheduleRisk,
          calculatedAt: input.risk.calculatedAt.toISOString(),
        }
      : null,
    blockers,
    nextAction: nextAction(input.project.status, blockers),
    sources: {
      complete: missingSources.length === 0,
      missing: missingSources,
      methodVersion: "project-lifecycle.v1",
    },
  };
}

function addBlocker(blockers: Blocker[], blocker: Blocker): void {
  if (!blockers.some((item) => item.code === blocker.code)) blockers.push(blocker);
}

function nextAction(
  status: LifecycleProjectionInput["project"]["status"],
  blockers: Blocker[],
): ProjectLifecycleProjection["nextAction"] {
  const blocker = blockers[0];
  if (blocker) {
    const labels: Record<string, string> = {
      active_dispute: "Resolver la disputa activa",
      project_blocked: "Resolver el bloqueo del proyecto",
      overdue: "Revisar el vencimiento del proyecto",
      rejected_milestone: "Corregir y volver a enviar el hito rechazado",
      failed_evidence: "Reemplazar la evidencia fallida",
      missing_required_evidence: "Capturar la evidencia requerida",
      critical_risk: "Revisar y mitigar el riesgo crítico",
      missing_milestones: "Crear los hitos del proyecto",
      pending_review: "Revisar los hitos enviados",
      draft_milestone: "Enviar el siguiente hito a revisión",
      expense_overrun: "Revisar el sobrecosto del proyecto",
      funding_gap: "Completar los fondos comprometidos",
      approved_milestone: "Liberar el pago del hito aprobado",
      payment_holdback: "Revisar el holdback pendiente",
    };
    return {
      code: blocker.code,
      label: labels[blocker.code] ?? blocker.message,
      owner: blocker.owner,
    };
  }

  if (status === "completed") {
    return { code: "complete", label: "Proyecto completado", owner: "system" };
  }
  if (status === "cancelled") {
    return { code: "cancelled", label: "Proyecto cancelado", owner: "system" };
  }
  if (status === "open") {
    return {
      code: "start_project",
      label: "Iniciar la ejecución del proyecto",
      owner: "professional",
    };
  }
  return {
    code: "monitor_execution",
    label: "Continuar la ejecución del proyecto",
    owner: "professional",
  };
}

function commercialStage(input: LifecycleProjectionInput): ProjectCommercialStage {
  if (input.project.status === "cancelled" || input.project.jobStatus === "CANCELLED") {
    return "cancelled";
  }
  if (input.project.status === "completed" || input.project.jobStatus === "COMPLETED") {
    return "closed";
  }
  if (input.project.contract?.signedClientAt && input.project.contract.signedProAt) {
    return "contract_signed";
  }
  if (input.project.contract) return "contract_pending";
  if (
    input.project.acceptedBidCount > 0 ||
    ["ACCEPTED", "AWARDED", "IN_PROGRESS", "REVIEW", "DISPUTE"].includes(
      input.project.jobStatus,
    )
  ) {
    return "awarded";
  }
  if (input.project.jobStatus === "RESERVED") return "reserved";
  if (["POSTED", "PUBLISHED"].includes(input.project.jobStatus)) return "sourcing";
  return "draft";
}

function riskLevel(score: number): NonNullable<ProjectLifecycleProjection["risk"]>["level"] {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function parseAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function sumTransactions(
  transactions: LifecycleTransaction[],
  type: string,
): number {
  return money(
    transactions
      .filter((transaction) => transaction.type === type)
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  );
}

function latestDate(values: Array<Date | null | undefined>): Date {
  const valid = values.filter((value): value is Date => value instanceof Date);
  return valid.sort((left, right) => right.getTime() - left.getTime())[0] ?? new Date(0);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeForHash(value));
}

function normalizeForHash(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeForHash(item)]),
    );
  }
  return value;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatAmount(value: number, currency: string | null): string {
  const formatted = money(value).toFixed(2);
  return currency ? `${currency} ${formatted}` : formatted;
}

function byId<T extends { id: string }>(left: T, right: T): number {
  return left.id.localeCompare(right.id);
}
