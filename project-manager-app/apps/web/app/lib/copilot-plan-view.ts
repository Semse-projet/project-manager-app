import type { CopilotWorkPlan } from "../semse-api";

export function getCopilotPlanStatusLabel(status: CopilotWorkPlan["status"]): string {
  switch (status) {
    case "pending_approval":
      return "Pendiente de aprobación";
    case "approved":
      return "Plan aprobado";
    case "executing":
      return "En ejecución";
    case "completed":
      return "Completado";
    case "cancelled":
      return "Cancelado";
    case "rejected":
      return "Rechazado";
    default:
      return status;
  }
}

/** Returns a semantic color class for use with Tailwind or CSS variables */
export function getCopilotPlanStatusColor(status: CopilotWorkPlan["status"]): "warning" | "success" | "info" | "error" | "muted" {
  switch (status) {
    case "pending_approval": return "warning";
    case "approved":         return "info";
    case "executing":        return "info";
    case "completed":        return "success";
    case "rejected":         return "error";
    case "cancelled":        return "muted";
    default:                 return "muted";
  }
}

export function getCopilotPlanStepStatusLabel(status: CopilotWorkPlan["steps"][number]["status"]): string {
  switch (status) {
    case "ready":
      return "Listo";
    case "executing":
      return "En ejecución";
    case "blocked":
      return "Bloqueado";
    case "completed":
      return "Completado";
    case "failed":
      return "Falló";
    case "skipped":
      return "Omitido";
    case "pending":
    default:
      return "Pendiente";
  }
}

export function getCopilotPlanProgress(plan: CopilotWorkPlan): NonNullable<CopilotWorkPlan["progress"]> {
  return plan.progress ?? {
    totalSteps: plan.steps.length,
    completedSteps: plan.steps.filter((step) => step.status === "completed").length,
    skippedSteps: plan.steps.filter((step) => step.status === "skipped").length,
    blockedSteps: plan.steps.filter((step) => step.status === "blocked").length,
    readySteps: plan.steps.filter((step) => step.status === "ready").length,
    executingSteps: plan.steps.filter((step) => step.status === "executing").length,
    failedSteps: plan.steps.filter((step) => step.status === "failed").length,
    percent: plan.steps.length === 0
      ? 0
      : Math.round((plan.steps.filter((step) => step.status === "completed" || step.status === "skipped").length / plan.steps.length) * 100),
  };
}

export function buildCopilotPlanStepFacts(step: CopilotWorkPlan["steps"][number]): string[] {
  const facts: string[] = [];
  if (step.capability) facts.push(`Capability: ${step.capability}`);
  if (step.toolsAllowed.length) facts.push(`Tools: ${step.toolsAllowed.join(", ")}`);
  if (step.requiresApprovedPlan) facts.push("Requiere plan aprobado");
  if (step.dependsOnStepIds?.length) facts.push(`Depende de: ${step.dependsOnStepIds.join(", ")}`);
  if (step.requiredEvidence?.length) facts.push(`Evidencia: ${step.requiredEvidence.join(", ")}`);
  if (step.evidenceStatus) facts.push(`Estado evidencia: ${step.evidenceStatus}`);
  if (step.boundAction) facts.push(`Acción: ${step.boundAction.actionType} (${step.boundAction.approvalMode})`);
  if (step.blockReason || step.blockedReason) facts.push(`Bloqueo: ${step.blockReason ?? step.blockedReason}`);
  return facts;
}

export function buildCopilotPlanSections(plan: CopilotWorkPlan): Array<{ title: string; items: string[] }> {
  const sections: Array<{ title: string; items: string[] }> = [];

  sections.push({ title: "Objetivo", items: [plan.goal] });

  if (plan.rationale) {
    sections.push({ title: "Fundamento", items: [plan.rationale] });
  }
  if (plan.risks.length) {
    sections.push({ title: "Riesgos", items: plan.risks });
  }
  if (plan.requiredEvidence.length) {
    sections.push({ title: "Evidencia requerida", items: plan.requiredEvidence });
  }
  if (plan.successCriteria.length) {
    sections.push({ title: "Criterios de éxito", items: plan.successCriteria });
  }

  return sections;
}

/**
 * Returns the next step the user or agent should act on.
 * Priority: executing > ready > blocked (surfaced for attention).
 */
export function getNextActionableStep(
  plan: CopilotWorkPlan
): CopilotWorkPlan["steps"][number] | null {
  const executing = plan.steps.find((s) => s.status === "executing");
  if (executing) return executing;
  const ready = plan.steps.find((s) => s.status === "ready");
  if (ready) return ready;
  const failed = plan.steps.find((s) => s.status === "failed");
  if (failed) return failed;
  const blocked = plan.steps.find((s) => s.status === "blocked");
  return blocked ?? null;
}

/**
 * Returns true if a step can be safely skipped by the operator
 * (low-risk, not executing, not completed/skipped).
 */
export function isStepSkippable(step: CopilotWorkPlan["steps"][number]): boolean {
  if (step.status === "completed" || step.status === "skipped") return false;
  if (step.status === "executing") return false;
  if (step.requiresApproval) return false;
  return step.riskLevel === "low" || step.riskLevel === "medium";
}

export type PlanTimelineEntry = {
  stepId: string;
  title: string;
  status: CopilotWorkPlan["steps"][number]["status"];
  startedAt?: string;
  completedAt?: string;
  isCurrent: boolean;
};

/**
 * Builds an ordered timeline of steps for rendering a visual plan tracker.
 */
export function buildPlanTimeline(plan: CopilotWorkPlan): PlanTimelineEntry[] {
  const steps = [...plan.steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const nextStep = getNextActionableStep(plan);

  return steps.map((step) => ({
    stepId: step.id,
    title: step.title,
    status: step.status,
    startedAt: step.startedAt,
    completedAt: step.completedAt,
    isCurrent: step.id === nextStep?.id,
  }));
}
