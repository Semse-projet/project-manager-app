import { ForbiddenException, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { getActionPolicy } from "@semse/agents";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";
import type { PlanStepCapability } from "./plan-mode.types.js";
import {
  defaultRequiresApprovedPlan,
  inferPlanStepCapability,
  inferToolsAllowed,
} from "./plan-tool-policy.service.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlanStatus = "draft" | "active" | "executing" | "completed" | "cancelled" | "rejected";
export type PlanStepStatus = "pending" | "ready" | "executing" | "blocked" | "completed" | "failed" | "skipped";
export type PlanStepEvidenceStatus = "missing" | "partial" | "satisfied";

export type PlanBoundAction = {
  actionType: string;
  approvalMode: "manual" | "auto";
  riskLevel: "low" | "medium" | "high";
};

export type PlanStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  expectedOutcome: string;
  capability: PlanStepCapability;
  toolsAllowed: string[];
  actionType?: string;
  dependsOnStepIds?: string[];
  requiredEvidence?: string[];
  evidenceStatus?: PlanStepEvidenceStatus;
  boundAction?: PlanBoundAction;
  riskLevel: "low" | "medium" | "high";
  requiresApproval: boolean;
  requiresApprovedPlan: boolean;
  status: PlanStepStatus;
  blockReason?: string;
  startedAt?: string;
  completedAt?: string;
  blockedReason?: string;
};

export type PlanMeta = {
  goal?: string;
  rationale?: string;
  risks?: string[];
  requiredEvidence?: string[];
  successCriteria?: string[];
};

export type WorkPlanRecord = {
  id: string;
  tenantId: string;
  orgId: string;
  projectId?: string;
  createdBy: string;
  agentId: string;
  title: string;
  description?: string;
  status: PlanStatus;
  steps: PlanStep[];
  meta?: PlanMeta;
  threadId?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  createdAt: string;
  updatedAt: string;
};

type StoredPlan = {
  id: string;
  tenantId: string;
  orgId: string;
  projectId: string | null;
  createdBy: string;
  agentId: string;
  title: string;
  description: string | null;
  status: string;
  stepsJson: unknown;
  contextJson: unknown;
  metaJson: unknown;
  threadId: string | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  rejectedAt: Date | null;
  rejectedBy: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function readPlanStatus(value: unknown): PlanStatus {
  return value === "draft" ||
    value === "active" ||
    value === "executing" ||
    value === "completed" ||
    value === "cancelled" ||
    value === "rejected"
    ? value
    : "draft";
}

function readStepStatus(value: unknown): PlanStepStatus {
  if (value === "ready" || value === "approved") return "ready";
  if (value === "executing" || value === "in_progress") return "executing";
  if (value === "completed") return "completed";
  if (value === "blocked") return "blocked";
  if (value === "failed") return "failed";
  if (value === "skipped") return "skipped";
  return "pending";
}

function readEvidenceStatus(value: unknown): PlanStepEvidenceStatus | undefined {
  return value === "missing" || value === "partial" || value === "satisfied" ? value : undefined;
}

function toStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function buildBoundAction(step: {
  actionType?: string;
  riskLevel: "low" | "medium" | "high";
  requiresApproval: boolean;
}, raw: Record<string, unknown>): PlanBoundAction | undefined {
  const provided = raw.boundAction && typeof raw.boundAction === "object"
    ? raw.boundAction as Record<string, unknown>
    : null;

  const actionType = typeof provided?.actionType === "string" && provided.actionType.trim().length > 0
    ? provided.actionType.trim()
    : step.actionType;

  if (!actionType) return undefined;

  const fallbackPolicy = (() => {
    try {
      return getActionPolicy(actionType as never);
    } catch {
      return null;
    }
  })();

  const riskLevel = provided?.riskLevel === "low" || provided?.riskLevel === "medium" || provided?.riskLevel === "high"
    ? provided.riskLevel
    : fallbackPolicy?.riskLevel ?? step.riskLevel;

  const approvalMode = provided?.approvalMode === "manual" || provided?.approvalMode === "auto"
    ? provided.approvalMode
    : fallbackPolicy?.approvalMode === "required"
    ? "manual"
    : step.requiresApproval
    ? "manual"
    : "auto";

  return { actionType, approvalMode, riskLevel };
}

function normalizePlanStep(raw: unknown, idx: number): PlanStep {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const riskLevel = (r.riskLevel === "low" || r.riskLevel === "medium" || r.riskLevel === "high")
    ? r.riskLevel
    : "medium";
  const actionType = typeof r.actionType === "string" ? r.actionType : undefined;
  const requiresApproval = typeof r.requiresApproval === "boolean" ? r.requiresApproval : riskLevel === "high";
  const capability = inferPlanStepCapability({
    capability: r.capability,
    actionType,
    title: r.title,
    toolsAllowed: r.toolsAllowed,
    riskLevel,
  });
  const blockedReason = typeof r.blockedReason === "string"
    ? r.blockedReason
    : typeof r.blockReason === "string"
    ? r.blockReason
    : undefined;

  const normalized: PlanStep = {
    id: typeof r.id === "string" ? r.id : `step_${idx}`,
    order: typeof r.order === "number" ? r.order : idx + 1,
    title: typeof r.title === "string" ? r.title : `Paso ${idx + 1}`,
    description: typeof r.description === "string" ? r.description : "",
    expectedOutcome: typeof r.expectedOutcome === "string" ? r.expectedOutcome : "",
    capability,
    toolsAllowed: inferToolsAllowed({ capability, toolsAllowed: r.toolsAllowed, actionType }),
    actionType,
    dependsOnStepIds: toStringList(r.dependsOnStepIds),
    requiredEvidence: toStringList(r.requiredEvidence),
    evidenceStatus: readEvidenceStatus(r.evidenceStatus),
    riskLevel,
    requiresApproval,
    requiresApprovedPlan: defaultRequiresApprovedPlan({
      capability,
      riskLevel,
      explicit: r.requiresApprovedPlan,
    }),
    status: readStepStatus(r.status),
    blockReason: blockedReason,
    startedAt: typeof r.startedAt === "string" ? r.startedAt : undefined,
    completedAt: typeof r.completedAt === "string" ? r.completedAt : undefined,
    blockedReason,
  };

  normalized.boundAction = buildBoundAction(normalized, r);
  return normalized;
}

function toRecord(plan: StoredPlan): WorkPlanRecord {
  const steps = Array.isArray(plan.stepsJson)
    ? plan.stepsJson.map((step, idx) => normalizePlanStep(step, idx))
    : [];

  return {
    id: plan.id,
    tenantId: plan.tenantId,
    orgId: plan.orgId,
    projectId: plan.projectId ?? undefined,
    createdBy: plan.createdBy,
    agentId: plan.agentId,
    title: plan.title,
    description: plan.description ?? undefined,
    status: readPlanStatus(plan.status),
    steps,
    meta: plan.metaJson && typeof plan.metaJson === "object" && !Array.isArray(plan.metaJson)
      ? plan.metaJson as PlanMeta
      : undefined,
    threadId: plan.threadId ?? undefined,
    approvedAt: plan.approvedAt?.toISOString(),
    approvedBy: plan.approvedBy ?? undefined,
    rejectedAt: plan.rejectedAt?.toISOString(),
    rejectedBy: plan.rejectedBy ?? undefined,
    cancelledAt: plan.cancelledAt?.toISOString(),
    cancelledBy: plan.cancelledBy ?? undefined,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class AgentWorkPlanService {
  private readonly logger = new Logger(AgentWorkPlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly sseBus?: SseEventBusService,
  ) {}

  private emitPlanUpdate(planId: string, data: unknown): void {
    this.sseBus?.emit(`plan:${planId}`, "plan-update", data);
  }

  async create(input: {
    tenantId: string;
    orgId: string;
    projectId?: string;
    createdBy: string;
    agentId: string;
    title: string;
    description?: string;
    steps: Array<
      Omit<
        PlanStep,
        "status" | "evidenceStatus" | "boundAction" | "blockReason" | "startedAt" | "completedAt" | "blockedReason"
      > & { id?: string }
    >;
    threadId?: string;
    contextSnapshot?: Record<string, unknown>;
    meta?: PlanMeta;
  }): Promise<WorkPlanRecord> {
    const stepIds = input.steps.map((step, idx) =>
      typeof step.id === "string" && step.id.trim().length > 0 ? step.id.trim() : `step_${idx + 1}`,
    );
    const normalizedSteps = input.steps.map((step, idx) =>
      normalizePlanStep({
        ...step,
        id: stepIds[idx],
        order: idx + 1,
        status: "pending",
        dependsOnStepIds: step.dependsOnStepIds?.length
          ? step.dependsOnStepIds
          : idx > 0
          ? [stepIds[idx - 1]!]
          : [],
      }, idx),
    );

    const created = await this.prisma.agentWorkPlan.create({
      data: {
        tenantId: input.tenantId,
        orgId: input.orgId,
        projectId: input.projectId ?? null,
        createdBy: input.createdBy,
        agentId: input.agentId,
        title: input.title,
        description: input.description ?? null,
        status: "draft",
        stepsJson: normalizedSteps,
        contextJson: input.contextSnapshot ?? null,
        metaJson: input.meta ?? null,
        threadId: input.threadId ?? null,
      },
    });

    this.logger.log(`[plan] created id=${created.id} project=${input.projectId ?? "none"} steps=${normalizedSteps.length}`);
    return toRecord(created as StoredPlan);
  }

  async findById(tenantId: string, planId: string): Promise<WorkPlanRecord> {
    const plan = await this.prisma.agentWorkPlan.findFirst({
      where: { id: planId, tenantId },
    });
    if (!plan) throw new NotFoundException(`Work plan '${planId}' not found`);
    return toRecord(plan as StoredPlan);
  }

  async listByProject(tenantId: string, projectId: string, statuses?: PlanStatus[]): Promise<WorkPlanRecord[]> {
    const plans = await this.prisma.agentWorkPlan.findMany({
      where: {
        tenantId,
        projectId,
        ...(statuses?.length ? { status: { in: statuses } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return plans.map((plan: unknown) => toRecord(plan as StoredPlan));
  }

  async approve(input: {
    tenantId: string;
    planId: string;
    userId: string;
    orgId: string;
  }): Promise<WorkPlanRecord> {
    const plan = await this.findById(input.tenantId, input.planId);
    if (plan.status !== "draft") {
      throw new ForbiddenException(`Plan '${input.planId}' is not in draft status (current: ${plan.status})`);
    }

    const updated = await this.prisma.agentWorkPlan.update({
      where: { id: input.planId },
      data: { status: "active", approvedAt: new Date(), approvedBy: input.userId },
    });

    this.logger.log(`[plan] approved id=${input.planId} by=${input.userId}`);
    const record = toRecord(updated as StoredPlan);
    this.emitPlanUpdate(input.planId, record);
    return record;
  }

  async reject(input: {
    tenantId: string;
    planId: string;
    userId: string;
  }): Promise<WorkPlanRecord> {
    const plan = await this.findById(input.tenantId, input.planId);
    if (plan.status !== "draft") {
      throw new ForbiddenException(`Plan '${input.planId}' is not in draft status`);
    }

    const updated = await this.prisma.agentWorkPlan.update({
      where: { id: input.planId },
      data: { status: "rejected", rejectedAt: new Date(), rejectedBy: input.userId },
    });

    this.logger.log(`[plan] rejected id=${input.planId} by=${input.userId}`);
    const record = toRecord(updated as StoredPlan);
    this.emitPlanUpdate(input.planId, record);
    return record;
  }

  async completeStep(input: {
    tenantId: string;
    planId: string;
    stepId: string;
  }): Promise<WorkPlanRecord> {
    const plan = await this.findById(input.tenantId, input.planId);
    if (plan.status !== "active" && plan.status !== "executing") {
      throw new ForbiddenException("Plan must be active or executing to complete steps");
    }

    const updatedSteps = plan.steps.map((step) =>
      step.id === input.stepId
        ? {
            ...step,
            status: "completed" as const,
            startedAt: step.startedAt ?? new Date().toISOString(),
            completedAt: new Date().toISOString(),
            evidenceStatus: step.evidenceStatus ?? "satisfied",
            blockReason: undefined,
            blockedReason: undefined,
          }
        : step,
    );

    const doneStatuses: PlanStepStatus[] = ["completed", "skipped"];
    const allDone = updatedSteps.every((step) => doneStatuses.includes(step.status));

    const updated = await this.prisma.agentWorkPlan.update({
      where: { id: input.planId },
      data: {
        stepsJson: updatedSteps,
        status: allDone ? "completed" : "executing",
      },
    });

    const record = toRecord(updated as StoredPlan);
    this.emitPlanUpdate(input.planId, record);
    return record;
  }

  async blockStep(input: {
    tenantId: string;
    planId: string;
    stepId: string;
    reason: string;
  }): Promise<WorkPlanRecord> {
    const plan = await this.findById(input.tenantId, input.planId);
    if (plan.status === "completed" || plan.status === "cancelled" || plan.status === "rejected") {
      throw new ForbiddenException(`Plan '${input.planId}' can no longer be updated (current: ${plan.status})`);
    }

    const updatedSteps = plan.steps.map((step) =>
      step.id === input.stepId
        ? {
            ...step,
            status: "blocked" as const,
            blockReason: input.reason,
            blockedReason: input.reason,
          }
        : step,
    );

    const updated = await this.prisma.agentWorkPlan.update({
      where: { id: input.planId },
      data: {
        stepsJson: updatedSteps,
        status: plan.status === "draft" ? "draft" : "executing",
      },
    });

    const record = toRecord(updated as StoredPlan);
    this.emitPlanUpdate(input.planId, record);
    return record;
  }

  async saveGraph(input: {
    tenantId: string;
    planId: string;
    steps: PlanStep[];
    status?: PlanStatus;
  }): Promise<WorkPlanRecord> {
    await this.findById(input.tenantId, input.planId);
    const updated = await this.prisma.agentWorkPlan.update({
      where: { id: input.planId },
      data: {
        stepsJson: input.steps,
        ...(input.status ? { status: input.status } : {}),
      },
    });
    return toRecord(updated as StoredPlan);
  }

  async cancel(input: {
    tenantId: string;
    planId: string;
    userId: string;
  }): Promise<WorkPlanRecord> {
    const plan = await this.findById(input.tenantId, input.planId);
    if (plan.status === "completed" || plan.status === "cancelled") {
      throw new ForbiddenException(`Plan '${input.planId}' is already ${plan.status}`);
    }

    const updated = await this.prisma.agentWorkPlan.update({
      where: { id: input.planId },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: input.userId,
      },
    });

    this.logger.log(`[plan] cancelled id=${input.planId} by=${input.userId}`);
    const record = toRecord(updated as StoredPlan);
    this.emitPlanUpdate(input.planId, record);
    return record;
  }

  /**
   * Skip a step that is not required for the plan to succeed.
   * Useful for low-risk steps where conditions no longer apply.
   */
  async skipStep(input: {
    tenantId: string;
    planId: string;
    stepId: string;
    reason?: string;
  }): Promise<WorkPlanRecord> {
    const plan = await this.findById(input.tenantId, input.planId);
    if (plan.status === "completed" || plan.status === "cancelled" || plan.status === "rejected") {
      throw new ForbiddenException(`Plan '${input.planId}' can no longer be updated (current: ${plan.status})`);
    }

    const step = plan.steps.find((s) => s.id === input.stepId);
    if (!step) throw new ForbiddenException(`Paso '${input.stepId}' no existe en el plan.`);
    if (step.status === "completed" || step.status === "skipped") {
      return plan; // idempotent
    }
    if (step.requiresApproval || step.riskLevel === "high") {
      throw new ForbiddenException(`Paso de alto riesgo '${step.title}' no puede omitirse sin aprobación explícita.`);
    }

    const updatedSteps = plan.steps.map((s) =>
      s.id === input.stepId
        ? {
            ...s,
            status: "skipped" as const,
            blockReason: input.reason ?? "Omitido por el operador.",
            blockedReason: input.reason ?? "Omitido por el operador.",
            completedAt: new Date().toISOString(),
          }
        : s,
    );

    const doneStatuses: PlanStepStatus[] = ["completed", "skipped"];
    const allDone = updatedSteps.every((s) => doneStatuses.includes(s.status));

    const updated = await this.prisma.agentWorkPlan.update({
      where: { id: input.planId },
      data: {
        stepsJson: updatedSteps,
        status: allDone ? "completed" : plan.status === "draft" ? "draft" : "executing",
      },
    });

    this.logger.log(`[plan] step skipped id=${input.planId} step=${input.stepId}`);
    const record = toRecord(updated as StoredPlan);
    this.emitPlanUpdate(input.planId, record);
    return record;
  }

  /**
   * Archive (cancel) any currently active plan for a project before creating a new one.
   * Prevents orphaned "zombie" plans from blocking future work.
   */
  async archiveActivePlan(input: {
    tenantId: string;
    projectId: string;
    cancelledBy: string;
    reason?: string;
  }): Promise<WorkPlanRecord | null> {
    const active = await this.getActivePlan(input.tenantId, input.projectId);
    if (!active) return null;

    const updated = await this.prisma.agentWorkPlan.update({
      where: { id: active.id },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: input.cancelledBy,
      },
    });

    this.logger.log(`[plan] archived active plan id=${active.id} for project=${input.projectId} reason=${input.reason ?? "superseded"}`);
    return toRecord(updated as StoredPlan);
  }

  async getActivePlan(tenantId: string, projectId: string): Promise<WorkPlanRecord | null> {
    const plan = await this.prisma.agentWorkPlan.findFirst({
      where: {
        tenantId,
        projectId,
        status: { in: ["draft", "active", "executing"] },
      },
      orderBy: { updatedAt: "desc" },
    });

    return plan ? toRecord(plan as StoredPlan) : null;
  }

  getPlanContextBlock(plan: WorkPlanRecord | null): string {
    if (!plan) return "";

    const statusLabel: Record<PlanStatus, string> = {
      draft: "pendiente de aprobación",
      active: "aprobado y listo para ejecutar",
      executing: "en ejecución",
      completed: "completado",
      cancelled: "cancelado",
      rejected: "rechazado",
    };

    const lines: string[] = [
      "## Plan activo del proyecto",
      `**${plan.title}** — ${statusLabel[plan.status]}`,
    ];

    if (plan.meta?.goal) lines.push(`Objetivo: ${plan.meta.goal}`);
    if (plan.meta?.rationale) lines.push(`Fundamento: ${plan.meta.rationale}`);
    if (plan.meta?.risks?.length) lines.push(`Riesgos: ${plan.meta.risks.join("; ")}`);
    if (plan.meta?.requiredEvidence?.length) lines.push(`Evidencia requerida: ${plan.meta.requiredEvidence.join("; ")}`);
    if (plan.meta?.successCriteria?.length) lines.push(`Criterios de éxito: ${plan.meta.successCriteria.join("; ")}`);

    lines.push("", "Pasos:");
    for (const step of plan.steps) {
      const statusGlyph = step.status === "completed"
        ? "✓"
        : step.status === "ready"
        ? "▶"
        : step.status === "blocked"
        ? "!"
        : step.status === "failed"
        ? "✗"
        : step.status === "skipped"
        ? "⤼"
        : "○";

      lines.push(`  ${statusGlyph} [${step.riskLevel}] [${step.capability}] ${step.title}: ${step.description}`);
      if (step.toolsAllowed.length) {
        lines.push(`    tools: ${step.toolsAllowed.join(", ")}`);
      }
      if (step.expectedOutcome) {
        lines.push(`    resultado esperado: ${step.expectedOutcome}`);
      }
      if (step.blockedReason) {
        lines.push(`    bloqueo: ${step.blockedReason}`);
      }
    }

    if (plan.status === "active") {
      lines.push("", "REGLA: Este plan está aprobado. Las acciones de alto riesgo deben seguir el plan.");
    } else if (plan.status === "draft") {
      lines.push("", "REGLA: Este plan está pendiente de aprobación. Las acciones de alto riesgo están BLOQUEADAS hasta que el usuario apruebe.");
    }

    return lines.join("\n");
  }
}
