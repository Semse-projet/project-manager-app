import { Injectable } from "@nestjs/common";
import type {
  PrometeoMissionCheckpointInput,
  PrometeoMissionCreateInput,
  PrometeoMissionState,
  PrometeoProposedAction,
} from "@semse/schemas";
import { AgentWorkPlanService, type WorkPlanRecord } from "./agent-work-plan.service.js";
import { PlanExecutionService } from "./plan-execution.service.js";

type Actor = {
  tenantId: string;
  orgId: string;
  userId: string;
};

type CreateStep = Parameters<AgentWorkPlanService["create"]>[0]["steps"][number];

function actionRisk(action: PrometeoProposedAction): "low" | "medium" | "high" {
  return action.riskLevel === "critical" ? "high" : action.riskLevel;
}

function stepId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "action";
}

@Injectable()
export class PrometeoMissionService {
  private readonly workPlans: AgentWorkPlanService;
  private readonly planExecution: PlanExecutionService;

  constructor(
    workPlans: AgentWorkPlanService,
    planExecution: PlanExecutionService,
  ) {
    this.workPlans = workPlans;
    this.planExecution = planExecution;
  }

  async create(actor: Actor, input: PrometeoMissionCreateInput): Promise<PrometeoMissionState> {
    const needsApproval = input.proposedActions.some((action) => action.requiresApproval);
    const steps = this.buildSteps(input.proposedActions, needsApproval);
    const created = await this.workPlans.create({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      projectId: input.projectId,
      createdBy: actor.userId,
      agentId: "prometeo",
      title: input.title ?? input.goal,
      description: input.description ?? "Mision durable creada por Prometeo.",
      steps,
      threadId: input.threadId,
      contextSnapshot: {
        runtime: "prometeo",
        selectedEntities: input.selectedEntities,
        proposedActions: input.proposedActions,
        ...input.context,
      },
      meta: {
        goal: input.goal,
        rationale: "Prometeo mission runtime backed by AgentWorkPlan.",
        risks: input.proposedActions
          .filter((action) => action.riskLevel !== "low")
          .map((action) => `${action.namespace}.${action.tool}: ${action.riskLevel}`),
        successCriteria: input.successCriteria.length > 0
          ? input.successCriteria
          : ["Todos los pasos terminan con resultado verificable."],
      },
    });

    const planned = await this.workPlans.saveGraph({
      tenantId: actor.tenantId,
      planId: created.id,
      status: created.status,
      steps: created.steps.map((step) => ["observe", "interpret", "plan"].includes(step.id)
        ? {
            ...step,
            status: "completed" as const,
            startedAt: step.startedAt ?? created.createdAt,
            completedAt: step.completedAt ?? created.createdAt,
            evidenceStatus: step.evidenceStatus ?? "satisfied" as const,
          }
        : step),
    });

    if (needsApproval) return this.toMissionState(planned);

    const approved = await this.workPlans.approve({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      planId: planned.id,
      userId: actor.userId,
    });
    const reconciled = await this.planExecution.refreshPlanState({
      tenantId: actor.tenantId,
      planId: approved.id,
    });
    return this.toMissionState(reconciled);
  }

  async get(tenantId: string, missionId: string): Promise<PrometeoMissionState> {
    const plan = await this.workPlans.findById(tenantId, missionId);
    return this.toMissionState(plan);
  }

  async approve(actor: Actor, missionId: string): Promise<PrometeoMissionState> {
    const approved = await this.workPlans.approve({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      planId: missionId,
      userId: actor.userId,
    });
    const approvalStep = approved.steps.find((step) => step.id === "approval");
    const afterApproval = approvalStep
      ? await this.workPlans.completeStep({
          tenantId: actor.tenantId,
          planId: approved.id,
          stepId: approvalStep.id,
        })
      : approved;
    const reconciled = await this.planExecution.refreshPlanState({
      tenantId: actor.tenantId,
      planId: afterApproval.id,
    });
    return this.toMissionState(reconciled);
  }

  async reject(actor: Actor, missionId: string): Promise<PrometeoMissionState> {
    const plan = await this.workPlans.reject({
      tenantId: actor.tenantId,
      planId: missionId,
      userId: actor.userId,
    });
    return this.toMissionState(plan);
  }

  async cancel(actor: Actor, missionId: string): Promise<PrometeoMissionState> {
    const plan = await this.workPlans.cancel({
      tenantId: actor.tenantId,
      planId: missionId,
      userId: actor.userId,
    });
    return this.toMissionState(plan);
  }

  async checkpoint(
    actor: Actor,
    missionId: string,
    missionStepId: string,
    input: PrometeoMissionCheckpointInput,
  ): Promise<PrometeoMissionState> {
    const evidenceContext = { evidenceCount: input.evidenceCount };
    const common = {
      tenantId: actor.tenantId,
      planId: missionId,
      stepId: missionStepId,
      evidenceContext,
    };

    const plan = input.action === "start"
      ? await this.planExecution.startStep(common)
      : input.action === "complete"
      ? await this.planExecution.completeStep(common)
      : input.action === "block"
      ? await this.planExecution.blockStep({ ...common, reason: input.detail! })
      : input.action === "fail"
      ? await this.planExecution.failStep({ ...common, reason: input.detail! })
      : input.action === "retry"
      ? await this.planExecution.markStepReady(common)
      : await this.workPlans.skipStep({
          tenantId: actor.tenantId,
          planId: missionId,
          stepId: missionStepId,
          reason: input.detail,
        });

    return this.toMissionState(plan);
  }

  private buildSteps(actions: PrometeoProposedAction[], needsApproval: boolean): CreateStep[] {
    const baseSteps: CreateStep[] = [
      {
        id: "observe",
        order: 1,
        title: "Observar entrada y contexto",
        description: "Capturar contexto, entidades y evidencia asociada.",
        expectedOutcome: "Contexto suficiente para interpretar la solicitud.",
        capability: "perambulating",
        toolsAllowed: ["context.read"],
        riskLevel: "low",
        requiresApproval: false,
        requiresApprovedPlan: false,
      },
      {
        id: "interpret",
        order: 2,
        title: "Interpretar objetivo",
        description: "Resolver intencion, alcance y restricciones de la mision.",
        expectedOutcome: "Objetivo y restricciones tipados.",
        capability: "clouding",
        toolsAllowed: ["decision.classify_intent"],
        dependsOnStepIds: ["observe"],
        riskLevel: "low",
        requiresApproval: false,
        requiresApprovedPlan: false,
      },
      {
        id: "plan",
        order: 3,
        title: "Planificar ejecucion",
        description: "Vincular acciones permitidas y criterios de verificacion.",
        expectedOutcome: "Plan ejecutable y auditable.",
        capability: "composing",
        toolsAllowed: ["decision.plan"],
        dependsOnStepIds: ["interpret"],
        riskLevel: "low",
        requiresApproval: false,
        requiresApprovedPlan: false,
      },
    ];

    let dependency = "plan";
    if (needsApproval) {
      baseSteps.push({
        id: "approval",
        order: baseSteps.length + 1,
        title: "Resolver aprobacion humana",
        description: "Detener la mision hasta que un actor autorizado apruebe el plan.",
        expectedOutcome: "Decision humana registrada antes de cualquier mutacion.",
        capability: "waiting",
        toolsAllowed: ["approval.request.human"],
        dependsOnStepIds: [dependency],
        riskLevel: "high",
        requiresApproval: true,
        requiresApprovedPlan: false,
      });
      dependency = "approval";
    }

    const executionSteps = actions.length > 0
      ? actions.map((action, index): CreateStep => ({
          id: `execute-${stepId(action.id)}`,
          order: baseSteps.length + index + 1,
          title: `Ejecutar ${action.label}`,
          description: action.description ?? `${action.namespace}.${action.tool}`,
          expectedOutcome: "Resultado de herramienta registrado con referencia de auditoria.",
          capability: action.requiresApproval ? "worker" : "searching",
          toolsAllowed: [`${action.namespace}.${action.tool}`],
          actionType: `${action.namespace}.${action.tool}`,
          dependsOnStepIds: [dependency],
          riskLevel: actionRisk(action),
          requiresApproval: action.requiresApproval,
          requiresApprovedPlan: action.requiresApproval,
        }))
      : [{
          id: "execute-response",
          order: baseSteps.length + 1,
          title: "Preparar resultado",
          description: "Producir una respuesta estructurada sin mutar datos.",
          expectedOutcome: "Respuesta y bloques estructurados listos.",
          capability: "composing" as const,
          toolsAllowed: ["compose_response"],
          dependsOnStepIds: [dependency],
          riskLevel: "low" as const,
          requiresApproval: false,
          requiresApprovedPlan: false,
        }];

    const executionIds = executionSteps.map((step) => step.id!).filter(Boolean);
    return [
      ...baseSteps,
      ...executionSteps,
      {
        id: "verify",
        order: baseSteps.length + executionSteps.length + 1,
        title: "Verificar resultado",
        description: "Confirmar efectos, evidencia y criterios de exito.",
        expectedOutcome: "Mision cerrada con resultado verificable.",
        capability: "testing",
        toolsAllowed: ["runtime.verify"],
        dependsOnStepIds: executionIds,
        riskLevel: "low",
        requiresApproval: false,
        requiresApprovedPlan: false,
      },
    ];
  }

  private toMissionState(plan: WorkPlanRecord): PrometeoMissionState {
    const failedSteps = plan.steps.filter((step) => step.status === "failed");
    const blockedSteps = plan.steps.filter((step) => step.status === "blocked");
    const finishedSteps = plan.steps.filter((step) => step.status === "completed" || step.status === "skipped");
    const pendingApprovals = plan.status === "draft" && plan.steps.some((step) => step.requiresApproval)
      ? [`plan:${plan.id}`]
      : [];

    const status: PrometeoMissionState["status"] = plan.status === "completed"
      ? "completed"
      : plan.status === "cancelled"
      ? "cancelled"
      : plan.status === "rejected" || failedSteps.length > 0
      ? "failed"
      : pendingApprovals.length > 0
      ? "waiting_approval"
      : blockedSteps.length > 0
      ? "waiting_input"
      : plan.status === "active" || plan.status === "executing"
      ? "running"
      : "draft";

    const currentStep = plan.steps.find((step) => !["completed", "skipped"].includes(step.status));
    const phase = status === "waiting_approval"
      ? "approval"
      : status === "completed" || status === "failed" || status === "cancelled"
      ? status
      : currentStep?.id ?? "planning";

    return {
      id: plan.id,
      status,
      phase,
      goal: plan.meta?.goal ?? plan.title,
      projectId: plan.projectId,
      threadId: plan.threadId,
      durable: true,
      pendingApprovals,
      progress: {
        totalSteps: plan.steps.length,
        completedSteps: finishedSteps.length,
        blockedSteps: blockedSteps.length,
        failedSteps: failedSteps.length,
        percent: plan.steps.length === 0 ? 0 : Math.round((finishedSteps.length / plan.steps.length) * 100),
      },
      steps: plan.steps.map((step) => ({
        id: step.id,
        label: step.title,
        status: step.status === "executing"
          ? "running"
          : step.status === "ready"
          ? "pending"
          : step.status,
        detail: step.blockReason ?? step.blockedReason ?? step.expectedOutcome,
      })),
      traceId: `plan:${plan.id}`,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}
