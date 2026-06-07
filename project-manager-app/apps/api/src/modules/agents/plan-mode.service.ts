import { Injectable, Logger } from "@nestjs/common";
import { AgentWorkPlanService, type PlanStep, type WorkPlanRecord } from "./agent-work-plan.service.js";
import { PlanExecutionService } from "./plan-execution.service.js";
import { defaultRequiresApprovedPlan, inferPlanStepCapability, inferToolsAllowed } from "./plan-tool-policy.service.js";
import { AgentMemoryService } from "../knowledge/agent-memory.service.js";
import type {
  AgentPlanStepStatus,
  AgentWorkPlanStatus,
  CopilotPlanDraft,
  CopilotProposedPlan,
} from "./plan-mode.types.js";

function mapPlanStatus(status: WorkPlanRecord["status"]): AgentWorkPlanStatus {
  switch (status) {
    case "draft":
      return "pending_approval";
    case "active":
      return "approved";
    case "executing":
      return "executing";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "rejected":
      return "rejected";
    default:
      return "pending_approval";
  }
}

function mapStepStatus(status: PlanStep["status"]): AgentPlanStepStatus {
  switch (status) {
    case "ready":
      return "ready";
    case "executing":
      return "executing";
    case "blocked":
      return "blocked";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
    case "pending":
    default:
      return "pending";
  }
}

function computeProgress(record: WorkPlanRecord): CopilotProposedPlan["progress"] {
  const totalSteps = record.steps.length;
  const completedSteps = record.steps.filter((step) => step.status === "completed").length;
  const skippedSteps = record.steps.filter((step) => step.status === "skipped").length;
  const blockedSteps = record.steps.filter((step) => step.status === "blocked").length;
  const readySteps = record.steps.filter((step) => step.status === "ready").length;
  const executingSteps = record.steps.filter((step) => step.status === "executing").length;
  const failedSteps = record.steps.filter((step) => step.status === "failed").length;
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

function toProposedPlan(record: WorkPlanRecord): CopilotProposedPlan {
  return {
    id: record.id,
    title: record.title,
    goal: record.meta?.goal ?? record.description ?? "",
    rationale: record.meta?.rationale ?? "",
    description: record.description,
    status: mapPlanStatus(record.status),
    steps: record.steps.map((step) => ({
      id: step.id,
      order: step.order,
      title: step.title,
      description: step.description,
      expectedOutcome: step.expectedOutcome,
      capability: step.capability,
      toolsAllowed: step.toolsAllowed,
      actionType: step.actionType,
      dependsOnStepIds: step.dependsOnStepIds,
      requiredEvidence: step.requiredEvidence,
      evidenceStatus: step.evidenceStatus,
      boundAction: step.boundAction,
      riskLevel: step.riskLevel,
      requiresApproval: step.requiresApproval,
      requiresApprovedPlan: step.requiresApprovedPlan,
      status: mapStepStatus(step.status),
      blockReason: step.blockReason,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      blockedReason: step.blockReason ?? step.blockedReason,
    })),
    risks: record.meta?.risks ?? [],
    requiredEvidence: record.meta?.requiredEvidence ?? [],
    successCriteria: record.meta?.successCriteria ?? [],
    progress: computeProgress(record),
    approvedAt: record.approvedAt,
    createdAt: record.createdAt,
  };
}

@Injectable()
export class PlanModeService {
  private readonly logger = new Logger(PlanModeService.name);

  constructor(
    private readonly workPlans: AgentWorkPlanService,
    private readonly planExecution: PlanExecutionService,
    private readonly agentMemory: AgentMemoryService,
  ) {}

  async createPlan(input: {
    tenantId: string;
    orgId: string;
    projectId: string;
    createdBy: string;
    agentId: string;
    threadId?: string;
    contextSnapshot?: Record<string, unknown>;
    plan: CopilotPlanDraft;
  }): Promise<CopilotProposedPlan> {
    // Archive any existing active plan before creating a new one (prevents zombie plans)
    const archived = await this.workPlans.archiveActivePlan({
      tenantId: input.tenantId,
      projectId: input.projectId,
      cancelledBy: input.createdBy,
      reason: "Superseded by new plan",
    });
    if (archived) {
      this.logger.log(`[plan_mode] archived previous plan id=${archived.id} to make room for new plan`);
      void this.agentMemory.createMemory({
        tenantId: input.tenantId,
        orgId: input.orgId,
        agentId: input.agentId,
        projectId: input.projectId,
        type: "event",
        content: `Plan anterior '${archived.title}' archivado automáticamente al crear nuevo plan.`,
        summary: `Plan archivado: ${archived.title}`,
        importanceScore: 2,
        tags: ["plan", "archived", `plan:${archived.id}`],
      }).catch(() => undefined);
    }
    const normalizedSteps = input.plan.steps.map((step) => {
      const capability = inferPlanStepCapability({
        capability: step.capability,
        actionType: step.actionType,
        title: step.title,
        toolsAllowed: step.toolsAllowed,
        riskLevel: step.riskLevel,
      });

      return {
        ...step,
        capability,
        toolsAllowed: inferToolsAllowed({
          capability,
          toolsAllowed: step.toolsAllowed,
          actionType: step.actionType,
        }),
        requiresApprovedPlan: defaultRequiresApprovedPlan({
          capability,
          riskLevel: step.riskLevel,
          explicit: step.requiresApprovedPlan,
        }),
      };
    });

    const created = await this.workPlans.create({
      tenantId: input.tenantId,
      orgId: input.orgId,
      projectId: input.projectId,
      createdBy: input.createdBy,
      agentId: input.agentId,
      title: input.plan.title,
      description: input.plan.description,
      steps: normalizedSteps,
      threadId: input.threadId,
      contextSnapshot: input.contextSnapshot,
      meta: {
        goal: input.plan.goal,
        rationale: input.plan.rationale,
        risks: input.plan.risks,
        requiredEvidence: input.plan.requiredEvidence,
        successCriteria: input.plan.successCriteria,
      },
    });

    return toProposedPlan(created);
  }

  async getActivePlan(tenantId: string, projectId: string): Promise<CopilotProposedPlan | null> {
    const plan = await this.workPlans.getActivePlan(tenantId, projectId);
    return plan ? toProposedPlan(plan) : null;
  }

  async approvePlan(input: {
    tenantId: string;
    orgId: string;
    planId: string;
    userId: string;
  }): Promise<CopilotProposedPlan> {
    const plan = await this.workPlans.approve(input);
    const proposed = toProposedPlan(plan);
    void this.agentMemory.createMemory({
      tenantId: input.tenantId,
      orgId: input.orgId,
      agentId: "project-copilot",
      projectId: plan.projectId,
      type: "decision",
      content: `Plan '${plan.title}' aprobado por ${input.userId}. Listo para ejecución.`,
      summary: `Plan aprobado: ${plan.title}`,
      importanceScore: 5,
      tags: ["plan", "approved", `plan:${plan.id}`],
      sourceRef: plan.id,
    }).catch(() => undefined);
    return proposed;
  }

  async rejectPlan(input: {
    tenantId: string;
    planId: string;
    userId: string;
    orgId?: string;
  }): Promise<CopilotProposedPlan> {
    const plan = await this.workPlans.reject(input);
    const proposed = toProposedPlan(plan);
    void this.agentMemory.createMemory({
      tenantId: input.tenantId,
      orgId: input.orgId ?? input.tenantId,
      agentId: "project-copilot",
      projectId: plan.projectId,
      type: "decision",
      content: `Plan '${plan.title}' rechazado por ${input.userId}. El agente debe proponer un plan alternativo.`,
      summary: `Plan rechazado: ${plan.title}`,
      importanceScore: 4,
      tags: ["plan", "rejected", `plan:${plan.id}`],
      sourceRef: plan.id,
    }).catch(() => undefined);
    return proposed;
  }

  async cancelPlan(input: {
    tenantId: string;
    planId: string;
    userId: string;
    orgId?: string;
  }): Promise<CopilotProposedPlan> {
    const plan = await this.workPlans.cancel(input);
    const proposed = toProposedPlan(plan);
    void this.agentMemory.createMemory({
      tenantId: input.tenantId,
      orgId: input.orgId ?? input.tenantId,
      agentId: "project-copilot",
      projectId: plan.projectId,
      type: "event",
      content: `Plan '${plan.title}' cancelado por ${input.userId}.`,
      summary: `Plan cancelado: ${plan.title}`,
      importanceScore: 3,
      tags: ["plan", "cancelled", `plan:${plan.id}`],
      sourceRef: plan.id,
    }).catch(() => undefined);
    return proposed;
  }

  async markStepCompleted(input: {
    tenantId: string;
    planId: string;
    stepId: string;
  }): Promise<CopilotProposedPlan> {
    const plan = await this.workPlans.completeStep(input);
    return toProposedPlan(plan);
  }

  async blockStep(input: {
    tenantId: string;
    planId: string;
    stepId: string;
    reason: string;
  }): Promise<CopilotProposedPlan> {
    const plan = await this.workPlans.blockStep(input);
    return toProposedPlan(plan);
  }

  async startStep(input: {
    tenantId: string;
    planId: string;
    stepId: string;
    evidenceCount?: number;
  }): Promise<CopilotProposedPlan> {
    const plan = await this.planExecution.startStep({
      tenantId: input.tenantId,
      planId: input.planId,
      stepId: input.stepId,
      evidenceContext: { evidenceCount: input.evidenceCount },
    });
    return toProposedPlan(plan);
  }

  async completeExecutableStep(input: {
    tenantId: string;
    planId: string;
    stepId: string;
    evidenceCount?: number;
  }): Promise<CopilotProposedPlan> {
    const plan = await this.planExecution.completeStep({
      tenantId: input.tenantId,
      planId: input.planId,
      stepId: input.stepId,
      evidenceContext: { evidenceCount: input.evidenceCount },
    });
    return toProposedPlan(plan);
  }

  async failExecutableStep(input: {
    tenantId: string;
    planId: string;
    stepId: string;
    reason: string;
    evidenceCount?: number;
  }): Promise<CopilotProposedPlan> {
    const plan = await this.planExecution.failStep({
      tenantId: input.tenantId,
      planId: input.planId,
      stepId: input.stepId,
      reason: input.reason,
      evidenceContext: { evidenceCount: input.evidenceCount },
    });
    return toProposedPlan(plan);
  }

  async retryStep(input: {
    tenantId: string;
    planId: string;
    stepId: string;
    evidenceCount?: number;
  }): Promise<CopilotProposedPlan> {
    const plan = await this.planExecution.markStepReady({
      tenantId: input.tenantId,
      planId: input.planId,
      stepId: input.stepId,
      evidenceContext: { evidenceCount: input.evidenceCount },
    });
    return toProposedPlan(plan);
  }

  async skipStep(input: {
    tenantId: string;
    planId: string;
    stepId: string;
    reason?: string;
  }): Promise<CopilotProposedPlan> {
    const plan = await this.workPlans.skipStep(input);
    return toProposedPlan(plan);
  }

  async getPlanById(tenantId: string, planId: string): Promise<CopilotProposedPlan> {
    const plan = await this.workPlans.findById(tenantId, planId);
    return toProposedPlan(plan);
  }

  async listByProject(tenantId: string, projectId: string): Promise<CopilotProposedPlan[]> {
    const plans = await this.workPlans.listByProject(tenantId, projectId);
    return plans.map(toProposedPlan);
  }

  getPlanContext(plan: CopilotProposedPlan | null): string {
    if (!plan) return "";

    const statusLabel: Record<AgentWorkPlanStatus, string> = {
      pending_approval: "pendiente de aprobación",
      approved: "aprobado",
      executing: "en ejecución",
      completed: "completado",
      cancelled: "cancelado",
      rejected: "rechazado",
    };

    const lines = [
      "## Plan activo del proyecto",
      `**${plan.title}** — ${statusLabel[plan.status]}`,
      `Objetivo: ${plan.goal}`,
    ];

    if (plan.rationale) lines.push(`Fundamento: ${plan.rationale}`);
    if (plan.risks.length) lines.push(`Riesgos: ${plan.risks.join("; ")}`);
    if (plan.requiredEvidence.length) lines.push(`Evidencia requerida: ${plan.requiredEvidence.join("; ")}`);
    if (plan.successCriteria.length) lines.push(`Criterios de éxito: ${plan.successCriteria.join("; ")}`);

    lines.push("", "Pasos:");
    for (const step of plan.steps) {
      lines.push(`- [${step.status}] [${step.riskLevel}] [${step.capability}] ${step.title}: ${step.description}`);
      if (step.expectedOutcome) lines.push(`  resultado esperado: ${step.expectedOutcome}`);
      if (step.toolsAllowed.length) lines.push(`  tools: ${step.toolsAllowed.join(", ")}`);
      if (step.dependsOnStepIds?.length) lines.push(`  depende de: ${step.dependsOnStepIds.join(", ")}`);
      if (step.requiredEvidence?.length) lines.push(`  evidencia: ${step.requiredEvidence.join(", ")}`);
      if (step.boundAction) lines.push(`  acción vinculada: ${step.boundAction.actionType} (${step.boundAction.approvalMode})`);
      if (step.blockReason || step.blockedReason) lines.push(`  bloqueo: ${step.blockReason ?? step.blockedReason}`);
    }

    if (plan.status === "pending_approval") {
      lines.push("", "REGLA: No ejecutes acciones de alto riesgo hasta que el usuario apruebe el plan.");
    }
    if (plan.status === "approved" || plan.status === "executing") {
      lines.push("", "REGLA: Ejecuta acciones de alto riesgo solo si encajan con este plan aprobado.");
    }

    return lines.join("\n");
  }
}
