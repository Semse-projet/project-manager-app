import { ForbiddenException, Injectable } from "@nestjs/common";
import type { AgentActionType } from "@semse/schemas";
import {
  AgentWorkPlanService,
  type PlanBoundAction,
  type PlanStatus,
  type PlanStep,
  type PlanStepEvidenceStatus,
  type PlanStepStatus,
  type WorkPlanRecord,
} from "./agent-work-plan.service.js";
import { PlanToolPolicyService } from "./plan-tool-policy.service.js";

export type PlanEvidenceContext = {
  evidenceCount?: number;
};

export type StepReadinessResult = {
  status: PlanStepStatus;
  evidenceStatus: PlanStepEvidenceStatus;
  blockReason?: string;
};

export type PlanProgress = {
  totalSteps: number;
  completedSteps: number;
  skippedSteps: number;
  blockedSteps: number;
  readySteps: number;
  executingSteps: number;
  failedSteps: number;
  percent: number;
};

export type StepExecutionGate =
  | { allowed: true; plan: WorkPlanRecord | null; step?: PlanStep }
  | { allowed: false; reason: string; plan: WorkPlanRecord | null; step?: PlanStep };

function isFinishedStatus(status: PlanStepStatus): boolean {
  return status === "completed" || status === "skipped";
}

function isAutoBlockReason(reason: string | undefined): boolean {
  if (!reason) return false;
  return (
    reason.startsWith("Dependencias pendientes:") ||
    reason.startsWith("Evidencia faltante:") ||
    reason.startsWith("El plan aún no está aprobado") ||
    reason.startsWith("El plan aún no está aprobado")
  );
}

function deriveEvidenceStatus(step: PlanStep, evidenceContext: PlanEvidenceContext): PlanStepEvidenceStatus {
  const required = step.requiredEvidence?.length ?? 0;
  if (required === 0) return "satisfied";

  const evidenceCount = evidenceContext.evidenceCount ?? 0;
  if (evidenceCount <= 0) return "missing";
  if (evidenceCount < required) return "partial";
  return "satisfied";
}

@Injectable()
export class PlanExecutionService {
  constructor(
    private readonly workPlans: AgentWorkPlanService,
    private readonly planToolPolicy: PlanToolPolicyService,
  ) {}

  evaluateStepReadiness(
    plan: WorkPlanRecord,
    step: PlanStep,
    evidenceContext: PlanEvidenceContext = {},
  ): StepReadinessResult {
    if (step.status === "completed" || step.status === "skipped") {
      return {
        status: step.status,
        evidenceStatus: step.evidenceStatus ?? deriveEvidenceStatus(step, evidenceContext),
      };
    }

    if (step.status === "executing") {
      return {
        status: "executing",
        evidenceStatus: step.evidenceStatus ?? deriveEvidenceStatus(step, evidenceContext),
      };
    }

    if (step.status === "failed") {
      return {
        status: "failed",
        evidenceStatus: step.evidenceStatus ?? deriveEvidenceStatus(step, evidenceContext),
        blockReason: step.blockReason ?? step.blockedReason,
      };
    }

    if (step.status === "blocked" && step.blockReason && !isAutoBlockReason(step.blockReason)) {
      return {
        status: "blocked",
        evidenceStatus: step.evidenceStatus ?? deriveEvidenceStatus(step, evidenceContext),
        blockReason: step.blockReason,
      };
    }

    if (step.requiresApprovedPlan && plan.status !== "active" && plan.status !== "executing" && plan.status !== "completed") {
      return {
        status: "blocked",
        evidenceStatus: step.evidenceStatus ?? deriveEvidenceStatus(step, evidenceContext),
        blockReason: "El plan aún no está aprobado.",
      };
    }

    const dependencies = step.dependsOnStepIds ?? [];
    if (dependencies.length > 0) {
      const incomplete = dependencies.filter((depId) => {
        const dependency = plan.steps.find((candidate) => candidate.id === depId);
        return dependency ? !isFinishedStatus(dependency.status) : true;
      });

      if (incomplete.length > 0) {
        return {
          status: "blocked",
          evidenceStatus: step.evidenceStatus ?? deriveEvidenceStatus(step, evidenceContext),
          blockReason: `Dependencias pendientes: ${incomplete.join(", ")}`,
        };
      }
    }

    const evidenceStatus = deriveEvidenceStatus(step, evidenceContext);
    if (evidenceStatus !== "satisfied") {
      return {
        status: "blocked",
        evidenceStatus,
        blockReason: `Evidencia faltante: ${(step.requiredEvidence ?? []).join(", ") || "contexto insuficiente"}`,
      };
    }

    return {
      status: "ready",
      evidenceStatus,
    };
  }

  getExecutableSteps(plan: WorkPlanRecord, evidenceContext: PlanEvidenceContext = {}): PlanStep[] {
    return plan.steps.filter((step) => this.evaluateStepReadiness(plan, step, evidenceContext).status === "ready");
  }

  evaluatePlanProgress(plan: WorkPlanRecord): PlanProgress {
    const totalSteps = plan.steps.length;
    const completedSteps = plan.steps.filter((step) => step.status === "completed").length;
    const skippedSteps = plan.steps.filter((step) => step.status === "skipped").length;
    const blockedSteps = plan.steps.filter((step) => step.status === "blocked").length;
    const readySteps = plan.steps.filter((step) => step.status === "ready").length;
    const executingSteps = plan.steps.filter((step) => step.status === "executing").length;
    const failedSteps = plan.steps.filter((step) => step.status === "failed").length;
    const percent = totalSteps === 0 ? 0 : Math.round(((completedSteps + skippedSteps) / totalSteps) * 100);

    return {
      totalSteps,
      completedSteps,
      skippedSteps,
      blockedSteps,
      readySteps,
      executingSteps,
      failedSteps,
      percent,
    };
  }

  async getActivePlan(input: {
    tenantId: string;
    projectId: string;
    evidenceContext?: PlanEvidenceContext;
  }): Promise<WorkPlanRecord | null> {
    const activePlan = await this.workPlans.getActivePlan(input.tenantId, input.projectId);
    if (!activePlan) return null;
    return this.reconcilePlan(activePlan, input.evidenceContext ?? {});
  }

  async refreshPlanState(input: {
    tenantId: string;
    planId: string;
    evidenceContext?: PlanEvidenceContext;
  }): Promise<WorkPlanRecord> {
    const plan = await this.workPlans.findById(input.tenantId, input.planId);
    return this.reconcilePlan(plan, input.evidenceContext ?? {});
  }

  async markStepReady(input: {
    tenantId: string;
    planId: string;
    stepId: string;
    evidenceContext?: PlanEvidenceContext;
  }): Promise<WorkPlanRecord> {
    const plan = await this.workPlans.findById(input.tenantId, input.planId);
    const steps = plan.steps.map((step) =>
      step.id === input.stepId
        ? {
            ...step,
            status: "pending" as const,
            blockReason: undefined,
            blockedReason: undefined,
          }
        : step,
    );
    const updated = await this.workPlans.saveGraph({ tenantId: input.tenantId, planId: input.planId, steps, status: plan.status });
    return this.reconcilePlan(updated, input.evidenceContext ?? {});
  }

  async startStep(input: {
    tenantId: string;
    planId: string;
    stepId: string;
    evidenceContext?: PlanEvidenceContext;
  }): Promise<WorkPlanRecord> {
    const plan = await this.refreshPlanState(input);
    const step = plan.steps.find((candidate) => candidate.id === input.stepId);
    if (!step) throw new ForbiddenException(`Paso '${input.stepId}' no existe en el plan.`);
    if (step.status !== "ready") {
      throw new ForbiddenException(step.blockReason ?? step.blockedReason ?? `Paso '${input.stepId}' no está listo para ejecutar.`);
    }

    const steps = plan.steps.map((candidate) =>
      candidate.id === input.stepId
        ? {
            ...candidate,
            status: "executing" as const,
            startedAt: candidate.startedAt ?? new Date().toISOString(),
            blockReason: undefined,
            blockedReason: undefined,
          }
        : candidate,
    );

    return this.workPlans.saveGraph({
      tenantId: input.tenantId,
      planId: input.planId,
      steps,
      status: "executing",
    });
  }

  async completeStep(input: {
    tenantId: string;
    planId: string;
    stepId: string;
    evidenceContext?: PlanEvidenceContext;
  }): Promise<WorkPlanRecord> {
    const plan = await this.workPlans.findById(input.tenantId, input.planId);
    const steps = plan.steps.map((step) =>
      step.id === input.stepId
        ? {
            ...step,
            status: "completed" as const,
            startedAt: step.startedAt ?? new Date().toISOString(),
            completedAt: new Date().toISOString(),
            evidenceStatus: step.evidenceStatus ?? deriveEvidenceStatus(step, input.evidenceContext ?? {}),
            blockReason: undefined,
            blockedReason: undefined,
          }
        : step,
    );
    const updated = await this.workPlans.saveGraph({
      tenantId: input.tenantId,
      planId: input.planId,
      steps,
      status: "executing",
    });
    return this.reconcilePlan(updated, input.evidenceContext ?? {});
  }

  async failStep(input: {
    tenantId: string;
    planId: string;
    stepId: string;
    reason: string;
    evidenceContext?: PlanEvidenceContext;
  }): Promise<WorkPlanRecord> {
    const plan = await this.workPlans.findById(input.tenantId, input.planId);
    const steps = plan.steps.map((step) =>
      step.id === input.stepId
        ? {
            ...step,
            status: "failed" as const,
            startedAt: step.startedAt ?? new Date().toISOString(),
            blockReason: input.reason,
            blockedReason: input.reason,
          }
        : step,
    );
    return this.workPlans.saveGraph({
      tenantId: input.tenantId,
      planId: input.planId,
      steps,
      status: "executing",
    });
  }

  async blockStep(input: {
    tenantId: string;
    planId: string;
    stepId: string;
    reason: string;
    evidenceContext?: PlanEvidenceContext;
  }): Promise<WorkPlanRecord> {
    const plan = await this.workPlans.findById(input.tenantId, input.planId);
    const steps = plan.steps.map((step) =>
      step.id === input.stepId
        ? {
            ...step,
            status: "blocked" as const,
            blockReason: input.reason,
            blockedReason: input.reason,
          }
        : step,
    );
    return this.workPlans.saveGraph({
      tenantId: input.tenantId,
      planId: input.planId,
      steps,
      status: plan.status === "draft" ? "draft" : "executing",
    });
  }

  async bindActionToStep(input: {
    tenantId: string;
    planId: string;
    stepId: string;
    action: {
      actionType: AgentActionType | string;
      approvalMode: "manual" | "auto";
      riskLevel: "low" | "medium" | "high";
    };
    evidenceContext?: PlanEvidenceContext;
  }): Promise<WorkPlanRecord> {
    const plan = await this.workPlans.findById(input.tenantId, input.planId);
    const steps = plan.steps.map((step) =>
      step.id === input.stepId
        ? {
            ...step,
            actionType: input.action.actionType,
            boundAction: input.action as PlanBoundAction,
          }
        : step,
    );
    const updated = await this.workPlans.saveGraph({
      tenantId: input.tenantId,
      planId: input.planId,
      steps,
      status: plan.status,
    });
    return this.reconcilePlan(updated, input.evidenceContext ?? {});
  }

  async resolveActionExecution(input: {
    tenantId: string;
    projectId: string;
    actionType: string;
    riskLevel: "low" | "medium" | "high";
    toolName?: string;
    evidenceContext?: PlanEvidenceContext;
  }): Promise<StepExecutionGate> {
    const activePlan = await this.workPlans.getActivePlan(input.tenantId, input.projectId);
    if (!activePlan) {
      if (input.riskLevel === "high") {
        return {
          allowed: false,
          reason: `La acción '${input.actionType}' no pertenece a un plan activo.`,
          plan: null,
        };
      }
      return { allowed: true, plan: null };
    }

    const plan = await this.reconcilePlan(activePlan, input.evidenceContext ?? {});
    const matchingSteps = plan.steps.filter((step) =>
      step.boundAction?.actionType === input.actionType || step.actionType === input.actionType,
    );

    const step = matchingSteps.find((candidate) => candidate.status === "ready")
      ?? matchingSteps.find((candidate) => candidate.status === "executing")
      ?? matchingSteps[0];

    const compatibleUnboundStep = step
      ? undefined
      : plan.steps.filter((candidate) =>
          (candidate.status === "ready" || candidate.status === "executing") &&
          !candidate.boundAction &&
          !candidate.actionType,
        )[0];

    if (!step && !compatibleUnboundStep) {
      return {
        allowed: false,
        reason: `La acción '${input.actionType}' no está vinculada a ningún step activo del plan.`,
        plan,
      };
    }

    const resolvedStep = step ?? compatibleUnboundStep!;
    const toolDecision = this.planToolPolicy.validateToolExecution({
      step: {
        capability: resolvedStep.capability,
        toolsAllowed: resolvedStep.toolsAllowed,
        requiresApprovedPlan: resolvedStep.requiresApprovedPlan,
        requiredEvidence: resolvedStep.requiredEvidence,
        evidenceStatus: resolvedStep.evidenceStatus,
        riskLevel: resolvedStep.riskLevel,
        status: resolvedStep.status,
      },
      toolName: (input.toolName ?? input.actionType).toLowerCase(),
      planApproved: plan.status === "active" || plan.status === "executing" || plan.status === "completed",
    });

    if (!toolDecision.allowed) {
      return {
        allowed: false,
        reason: toolDecision.reason,
        plan,
        step: resolvedStep,
      };
    }

    return { allowed: true, plan, step: resolvedStep };
  }

  private async reconcilePlan(plan: WorkPlanRecord, evidenceContext: PlanEvidenceContext): Promise<WorkPlanRecord> {
    const steps = plan.steps.map((step) => {
      const readiness = this.evaluateStepReadiness(plan, step, evidenceContext);
      const blockReason = readiness.blockReason;
      return {
        ...step,
        status: readiness.status,
        evidenceStatus: readiness.evidenceStatus,
        blockReason,
        blockedReason: blockReason,
      };
    });

    const nextStatus = this.derivePlanStatus(plan.status, steps);
    return this.workPlans.saveGraph({
      tenantId: plan.tenantId,
      planId: plan.id,
      steps,
      status: nextStatus,
    });
  }

  private derivePlanStatus(currentStatus: PlanStatus, steps: PlanStep[]): PlanStatus {
    if (currentStatus === "draft" || currentStatus === "cancelled" || currentStatus === "rejected") {
      return currentStatus;
    }

    if (steps.length > 0 && steps.every((step) => isFinishedStatus(step.status))) {
      return "completed";
    }

    if (steps.some((step) => step.status === "executing" || step.status === "completed" || step.status === "failed")) {
      return "executing";
    }

    return currentStatus === "executing" ? "active" : currentStatus;
  }
}
