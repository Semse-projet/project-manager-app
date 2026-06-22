import crypto from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import type { AgentApprovalRequest } from "@semse/agents";
import { getActionPolicy } from "@semse/agents";
import type { AgentAction, AgentActionType } from "@semse/schemas";
import { agentActionTypeSchema } from "@semse/schemas";
import { AgentMemoryService } from "../../knowledge/agent-memory.service.js";
import { AgentPolicyService } from "../agent-policy.service.js";
import { PlanExecutionService } from "../plan-execution.service.js";
import { PlanModeService } from "../plan-mode.service.js";
import type { CopilotProposedPlan } from "../plan-mode.types.js";
import { COPILOT_TOOLS, PLAN_TOOL_NAME, toolCallToProposedPlan, toolCallsToActions } from "./copilot-tools.js";
import { AuditService } from "../../../infrastructure/audit/audit.service.js";
import { DisputesRepository } from "../../disputes/disputes.repository.js";
import { DisputesService } from "../../disputes/disputes.service.js";
import { MilestonesRepository } from "../../milestones/milestones.repository.js";
import { MilestonesService } from "../../milestones/milestones.service.js";
import { PaymentsService } from "../../payments/payments.service.js";
import { ProjectsRepository } from "../../projects/projects.repository.js";
import { AgentApprovalService } from "../agent-approval.service.js";
import { AgentsService } from "../agents.service.js";
import { TechnicalRuntimeService } from "../technical-runtime.service.js";
import { UsersRepository } from "../../users/users.repository.js";
import { WorkspaceMemoryRepository } from "../../knowledge/workspace-memory.repository.js";
import { buildProjectCopilotPromptContext } from "./project-copilot.context.js";
import type {
  AgentActor,
  CorpusStatusView,
  ProjectAgentContextView,
  ProjectCopilotHarnessInput,
  ProjectCopilotHarnessOutput,
  ProjectCopilotHarnessRuntime,
  ProjectCopilotJournalView,
  ProjectSearchResponseView,
  ProjectWorkspaceView,
  RefreshTarget,
} from "./project-copilot.types.js";

function buildAgentAction(params: {
  id: string;
  type: AgentActionType;
  domain: AgentAction["domain"];
  summary: string;
  rationale: string;
  requiredInputs?: string[];
  payload: Record<string, unknown>;
  expectedOutcome: string;
}): AgentAction {
  const policy = getActionPolicy(params.type);
  return {
    id: params.id,
    type: params.type,
    domain: params.domain,
    summary: params.summary,
    rationale: params.rationale,
    requiredInputs: params.requiredInputs ?? [],
    riskLevel: policy.riskLevel,
    approvalMode: policy.approvalMode,
    toolCall: { toolName: params.type, payload: params.payload },
    expectedOutcome: params.expectedOutcome,
    eligibleAt: new Date().toISOString(),
  };
}

import { AgentDelegationService } from "../agent-delegation.service.js";
import { CoordinatorService } from "../coordinator.service.js";
import { PrometeoService } from "../../prometeo/prometeo.service.js";
import { OperationalContextService } from "../../ai-models/context/operational-context.service.js";
import { PrometeoOrchestratorService } from "../../ai-models/orchestrator/prometeo-orchestrator.service.js";

@Injectable()
export class ProjectCopilotHarness {
  private readonly logger = new Logger(ProjectCopilotHarness.name);

  constructor(
    private readonly agentsService: AgentsService,
    private readonly projectsRepository: ProjectsRepository,
    private readonly auditService: AuditService,
    private readonly agentApprovalService: AgentApprovalService,
    private readonly milestonesRepository: MilestonesRepository,
    private readonly milestonesService: MilestonesService,
    private readonly disputesRepository: DisputesRepository,
    private readonly disputesService: DisputesService,
    private readonly paymentsService: PaymentsService,
    private readonly agentMemory: AgentMemoryService,
    private readonly planModeService: PlanModeService,
    private readonly agentPolicy: AgentPolicyService,
    private readonly planExecutionService: PlanExecutionService,
    private readonly technicalRuntime: TechnicalRuntimeService,
    private readonly agentDelegationService: AgentDelegationService,
    private readonly coordinatorService: CoordinatorService,
    private readonly usersRepository: UsersRepository,
    private readonly workspaceMemoryRepository: WorkspaceMemoryRepository,
    private readonly prometeoService: PrometeoService,
    private readonly operationalContextService: OperationalContextService,
    private readonly prometeoOrchestrator: PrometeoOrchestratorService,
  ) {}

  // ── Public entry point ────────────────────────────────────────────────────

  async run(
    actor: AgentActor,
    requestId: string,
    input: ProjectCopilotHarnessInput
  ): Promise<ProjectCopilotHarnessOutput> {
    const runtime = await this.resolveRuntime(actor, requestId, input.projectId);

    switch (input.kind) {
      case "chat":
        return this.handleChat(runtime, input.message, input.threadId);
      case "search":
        return this.handleSearch(runtime, input.query, input.topK ?? 10);
      case "action":
        return this.handleAction(runtime, input.actionType, input.payload);
      case "refresh":
        return this.handleRefresh(runtime);
    }
  }

  // ── Step 1–4: Resolve runtime ─────────────────────────────────────────────

  private async resolveRuntime(
    actor: AgentActor,
    requestId: string,
    projectId: string
  ): Promise<ProjectCopilotHarnessRuntime> {
    const [workspace, context, journal, corpusStatus] = await Promise.all([
      this.resolveWorkspace(actor, projectId),
      this.resolveAgentContext(actor, projectId),
      this.resolveJournal(actor, projectId),
      this.resolveCorpusStatus(actor, projectId),
    ]);
    const activePlanRecord = await this.safeCall(() => this.planExecutionService.getActivePlan({
      tenantId: actor.tenantId,
      projectId,
      evidenceContext: { evidenceCount: corpusStatus.evidenceCount },
    }));
    const activePlan = activePlanRecord
      ? await this.safeCall(() => this.planModeService.getPlanById(actor.tenantId, activePlanRecord.id))
      : null;

    return { actor, requestId, projectId, workspace, context, journal, corpusStatus, activePlan: activePlan ?? null };
  }

  private async resolveWorkspace(
    actor: AgentActor,
    projectId: string
  ): Promise<ProjectWorkspaceView> {
    const identity = { tenantId: actor.tenantId, orgId: actor.orgId, userId: actor.userId, roles: actor.roles, projectId };

    const [project, escrow, lifecycle] = await Promise.all([
      this.projectsRepository.findById(identity),
      this.safeCall(() => this.projectsRepository.getEscrowSummary(identity)),
      this.safeCall(() => this.projectsRepository.getStatusChangeContext(identity)),
    ]);

    const p = project as Record<string, unknown>;
    const escrowData = escrow as Record<string, unknown> | null;
    const lifecycleData = lifecycle as Record<string, unknown> | null;
    const milestoneCounts = (lifecycleData?.milestoneCounts as Record<string, unknown> | undefined) ?? {};
    const jobId = typeof p.jobId === "string" && p.jobId.length > 0 ? p.jobId : undefined;

    const preferredProfessional = jobId
      ? await this.resolvePreferredProfessional(actor, jobId)
      : null;

    return {
      projectId,
      jobId,
      title: String(p.title ?? ""),
      status: String(p.status ?? ""),
      budgetTotal: Number(p.budgetMax ?? p.budgetMin ?? 0),
      milestonesTotal: Number(milestoneCounts.total ?? 0),
      milestonesApproved: Number(milestoneCounts.approved ?? 0),
      escrowStatus: String(escrowData?.status ?? "PENDING"),
      escrowFunded: Number(escrowData?.totalDeposited ?? escrowData?.totalAmount ?? 0),
      escrowReleased: Number(escrowData?.totalReleased ?? 0),
      preferredProfessional,
    };
  }

  private async resolvePreferredProfessional(
    actor: AgentActor,
    jobId: string,
  ): Promise<ProjectWorkspaceView["preferredProfessional"]> {
    const entries = await this.safeCall(() => this.workspaceMemoryRepository.query({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      workspaceId: `job:${jobId}`,
      kinds: ["decision"],
      tags: ["preferred-professional"],
    }));

    const raw = entries?.find((entry) => entry.tags.includes("preferred-professional"))?.body;
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as {
        userId?: unknown;
        displayName?: unknown;
        publicSlug?: unknown;
        selectedAt?: unknown;
      };

      if (typeof parsed.userId !== "string" || typeof parsed.displayName !== "string") {
        return null;
      }

      return {
        userId: parsed.userId,
        displayName: parsed.displayName,
        publicSlug: typeof parsed.publicSlug === "string" ? parsed.publicSlug : null,
        selectedAt: typeof parsed.selectedAt === "string" ? parsed.selectedAt : null,
      };
    } catch {
      return null;
    }
  }

  private async resolveAgentContext(
    actor: AgentActor,
    projectId: string
  ): Promise<ProjectAgentContextView> {
    const lifecycle = await this.safeCall(() =>
      this.projectsRepository.getStatusChangeContext({
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        userId: actor.userId,
        roles: actor.roles,
        projectId
      })
    );
    const lifecycleData = lifecycle as Record<string, unknown> | null;

    return {
      projectId,
      jobCount: 0,
      openDisputeCount: Number(lifecycleData?.activeDisputes ?? 0),
      lastActivityAt: null,
    };
  }

  private async resolveJournal(actor: AgentActor, projectId: string): Promise<ProjectCopilotJournalView> {
    const memories = await this.safeCall(() => this.agentMemory.getRecentJournal({
      tenantId: actor.tenantId,
      projectId,
      limit: 10,
    }));
    
    if (!memories) {
      return { projectId, entries: [] };
    }

    return { 
      projectId, 
      entries: memories.map(m => ({
        id: m.id,
        content: m.summary || m.content.slice(0, 200),
        createdAt: new Date(m.updatedAt).toISOString(),
        author: "agent",
      })) 
    };
  }

  private async resolveCorpusStatus(actor: AgentActor, projectId: string): Promise<CorpusStatusView> {
    const evidenceCount = await this.safeCall(() =>
      this.milestonesRepository.countProjectEvidence({ tenantId: actor.tenantId, projectId })
    );
    const count = evidenceCount ?? 0;
    return {
      projectId,
      documentCount: count,
      evidenceCount: count,
      indexedAt: count > 0 ? new Date().toISOString() : null,
      status: count > 0 ? "ready" : "empty",
    };
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  private async handleChat(
    runtime: ProjectCopilotHarnessRuntime,
    message: string,
    threadId: string | undefined
  ): Promise<ProjectCopilotHarnessOutput & { kind: "chat" }> {
    const { actor, projectId } = runtime;

    const [memoryContext, coordinatorSnapshot, assistantProfile, ragContext, operationalContext] = await Promise.all([
      this.agentMemory.injectRelevantContext({
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        agentId: "project-copilot",
        projectId,
        query: message,
        topK: 6,
      }).catch(() => ""),
      this.coordinatorService.collectProjectSnapshot({
        tenantId: actor.tenantId,
        coordinatorId: "project-copilot",
        projectId,
        limit: 10,
      }).catch(() => null),
      this.usersRepository.findProfile(actor.userId).catch(() => null),
      this.prometeoService.buildRagContext({
        tenantId: actor.tenantId,
        projectId,
        query: message,
        topK: 4,
      }).catch(() => null),
      this.operationalContextService.buildContext({
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        userId: actor.userId,
        role: actor.roles[0] ?? "CLIENT",
        projectId,
      }).catch(() => null),
    ]);

    const activePlanContext = this.planModeService.getPlanContext(runtime.activePlan);
    const coordinatorContext = coordinatorSnapshot
      ? this.coordinatorService.buildContextBlock(coordinatorSnapshot)
      : "";
    const detectedIntent = this.prometeoOrchestrator.classifyIntent(message);
    const routedPrometeoAgent = this.prometeoOrchestrator.routeToAgent(detectedIntent);
    const prometeoContext = ragContext?.contextBlock || "";
    const operationalContextBlock = operationalContext
      ? this.operationalContextService.formatContextBlock(operationalContext)
      : "";

    const llmContext = buildProjectCopilotPromptContext({
      projectId,
      workspace: runtime.workspace,
      context: runtime.context,
      corpusStatus: runtime.corpusStatus,
      memoryContext,
      prometeoContext: prometeoContext || undefined,
      operationalContext: operationalContextBlock || undefined,
      prometeoIntent: detectedIntent,
      routedAgent: routedPrometeoAgent.primaryAgent,
      activePlan: runtime.activePlan ?? undefined,
      activePlanContext,
      coordinatorContext: coordinatorContext || undefined,
      assistantTone: assistantProfile?.assistantTone ?? undefined,
      assistantLanguage: assistantProfile?.assistantLanguage ?? undefined,
      assistantVerbosity: assistantProfile?.assistantVerbosity ?? undefined,
      expertMode: assistantProfile?.expertMode ?? false,
    });

    const reply = await this.agentsService.chatWithTools({
      tenantId: actor.tenantId,
      userId: actor.userId,
      message,
      agentId: "project-copilot",
      threadId,
      context: llmContext,
      tools: COPILOT_TOOLS,
    });

    const planToolCall = reply.toolCalls.find((c) => c.toolName === PLAN_TOOL_NAME);
    const actionToolCalls = reply.toolCalls.filter((c) => c.toolName !== PLAN_TOOL_NAME);
    const rawProposedActions = toolCallsToActions(actionToolCalls);
    const filteredActions = await this.filterActionsAgainstPlan(runtime, rawProposedActions);

    let proposedPlan: CopilotProposedPlan | undefined;
    const planDraft = toolCallToProposedPlan(planToolCall);
    if (planDraft) {
      try {
        proposedPlan = await this.planModeService.createPlan({
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          projectId,
          createdBy: actor.userId,
          agentId: "project-copilot",
          threadId: reply.threadId,
          contextSnapshot: llmContext,
          plan: planDraft,
        });
        this.logger.log(`[plan_mode] plan created id=${proposedPlan.id} steps=${proposedPlan.steps.length}`);
      } catch (err) {
        this.logger.warn(`[plan_mode] failed to persist plan: ${String(err)}`);
      }
    }

    const sessionId = reply.threadId ?? crypto.randomUUID();
    void this.agentMemory.writeSessionSummary({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      projectId,
      sessionId,
      userMessage: message,
      agentResponse: reply.response,
      proposedActionTypes: rawProposedActions.map((a) => a.type),
      toolCallCount: reply.toolCalls.length,
    }).catch((err) => this.logger.warn(`[memory] writeSessionSummary failed: ${String(err)}`));

    // Autonomic session summary: richer extraction of decisions + actions
    void this.agentMemory.summarizeSessionAutonomic({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      agentId: "project-copilot",
      projectId,
      sessionId,
      messages: [
        { role: "user", content: message },
        { role: "assistant", content: reply.response },
      ],
    }).catch(() => undefined);

    if (rawProposedActions.length > 0) {
      for (const action of rawProposedActions) {
        void this.agentMemory.writeActionProposal({
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          userId: actor.userId,
          projectId,
          actionType: action.type,
          summary: action.summary,
          rationale: action.rationale,
        }).catch(() => undefined);
      }
    }

    await this.audit(runtime, "project.copilot.chat", {
      messageLength: message.length,
      activePlanId: runtime.activePlan?.id,
      memoryContextChars: memoryContext.length,
      proposedActionCount: rawProposedActions.length,
      proposedActionTypes: rawProposedActions.map((a) => a.type),
      blockedActionCount: filteredActions.blocked.length,
      proposedPlanId: proposedPlan?.id,
    });

    const refreshedActivePlan = runtime.activePlan
      ? await this.safeCall(() => this.planModeService.getActivePlan(actor.tenantId, projectId))
      : runtime.activePlan;

    this.logger.log(
      `[chat] project=${projectId} thread=${reply.threadId} ` +
      `proposals=${filteredActions.allowed.length} blocked=${filteredActions.blocked.length} plan=${proposedPlan?.id ?? "none"}`,
    );

    return {
      kind: "chat",
      threadId: reply.threadId,
      message: reply.response,
      citations: [],
      refreshTargets: filteredActions.allowed.length > 0 || filteredActions.blocked.length > 0 || proposedPlan || runtime.activePlan ? ["actions"] : [],
      proposedActions: filteredActions.allowed as AgentAction[],
      blockedActions: filteredActions.blocked,
      proposedPlan,
      workPlan: proposedPlan,
      activePlan: refreshedActivePlan ?? undefined,
      provider: (reply as { provider?: string }).provider,
      model: (reply as { model?: string }).model,
      mode: reply.mode,
    };
  }

  // ── Search ────────────────────────────────────────────────────────────────

  private async handleSearch(
    runtime: ProjectCopilotHarnessRuntime,
    query: string,
    topK: number
  ): Promise<ProjectCopilotHarnessOutput & { kind: "search" }> {
    await this.audit(runtime, "project.copilot.search", { query, topK });

    this.logger.log(`[search] project=${runtime.projectId} query="${query}"`);

    const result: ProjectSearchResponseView = { query, results: [] };

    return { kind: "search", result, refreshTargets: [] };
  }

  // ── Action ────────────────────────────────────────────────────────────────

  private async handleAction(
    runtime: ProjectCopilotHarnessRuntime,
    actionType: string,
    payload: Record<string, unknown>
  ): Promise<ProjectCopilotHarnessOutput & { kind: "action" }> {
    await this.audit(runtime, "project.copilot.action", { actionType, payload });

    this.logger.log(`[action] project=${runtime.projectId} type=${actionType}`);

    // Resolve policy — if the type is unknown, default to required for safety
    const knownType = this.resolveActionType(actionType);
    const policy = knownType ? getActionPolicy(knownType) : { approvalMode: "required" as const, riskLevel: "high" as const };
    const refreshTargets: RefreshTarget[] = ["workspace", "context", "journal", "runs", "actions", "corpus"];
    const evidenceContext = { evidenceCount: runtime.corpusStatus.evidenceCount };
    const gating = this.agentPolicy.checkActionAllowed({
      actionType,
      riskLevel: policy.riskLevel,
      activePlan: runtime.activePlan,
    });

    if (!gating.allowed) {
      await this.audit(runtime, "project.copilot.action.blocked_by_plan_policy", {
        actionType,
        reason: gating.reason,
        activePlanId: runtime.activePlan?.id,
      });

      return {
        kind: "action",
        success: false,
        message: gating.reason,
        approvalMode: policy.approvalMode,
        refreshTargets: runtime.activePlan ? ["actions"] : [],
      };
    }

    const executionGate = await this.planExecutionService.resolveActionExecution({
      tenantId: runtime.actor.tenantId,
      projectId: runtime.projectId,
      actionType,
      riskLevel: policy.riskLevel,
      evidenceContext,
    });

    if (!executionGate.allowed) {
      await this.audit(runtime, "project.copilot.action.blocked_by_step_gate", {
        actionType,
        reason: executionGate.reason,
        activePlanId: executionGate.plan?.id,
        stepId: executionGate.step?.id,
      });

      return {
        kind: "action",
        success: false,
        message: executionGate.reason,
        approvalMode: policy.approvalMode,
        refreshTargets: executionGate.plan ? ["actions"] : [],
      };
    }

    const linkedStep = executionGate.plan && executionGate.step
      ? { planId: executionGate.plan.id, stepId: executionGate.step.id }
      : undefined;

    if (linkedStep && (!executionGate.step?.boundAction || executionGate.step.boundAction.actionType !== actionType)) {
      await this.planExecutionService.bindActionToStep({
        tenantId: runtime.actor.tenantId,
        planId: linkedStep.planId,
        stepId: linkedStep.stepId,
        action: {
          actionType,
          approvalMode: policy.approvalMode === "required" ? "manual" : "auto",
          riskLevel: policy.riskLevel,
        },
        evidenceContext,
      }).catch(() => undefined);
    }

    // REQUIRED: register approval request and block execution — waits for explicit human approval
    if (policy.approvalMode === "required") {
      const approval = await this.registerApprovalRequest(runtime, actionType, payload, policy.riskLevel, linkedStep);

      await this.audit(runtime, "project.copilot.action.pending_approval", {
        actionType,
        approvalId: approval.id,
        approvalMode: "required",
        linkedPlanId: linkedStep?.planId,
        linkedStepId: linkedStep?.stepId,
      });

      return {
        kind: "action",
        success: true,
        message: `Acción '${actionType}' registrada para aprobación humana. Será ejecutada una vez aprobada.`,
        approvalId: approval.id,
        approvalStatus: "pending",
        approvalMode: "required",
        refreshTargets,
      };
    }

    // RECOMMENDED: register approval for audit trail, then auto-approve and execute
    if (policy.approvalMode === "recommended") {
      const approval = await this.registerAndAutoApprove(
        runtime, actionType, payload, policy.riskLevel,
        linkedStep,
        "Auto-approved (recommended mode — not a sensitive action)."
      );

      try {
        const executionSummary = await this.executeApprovedAction(runtime, actionType, payload, linkedStep);

        await this.audit(runtime, "project.copilot.action.executed", {
          actionType,
          approvalId: approval.id,
          approvalMode: "recommended",
          executionSummary,
        });

        return {
          kind: "action",
          success: true,
          message: `Acción '${actionType}' ejecutada.`,
          approvalId: approval.id,
          approvalStatus: approval.status,
          approvalMode: "recommended",
          executedAction: actionType,
          executionSummary,
          refreshTargets,
        };
      } catch (err) {
        return this.buildActionError(runtime, actionType, approval, "recommended", err, refreshTargets);
      }
    }

    // NONE: execute directly, no approval record needed
    try {
      const executionSummary = await this.executeApprovedAction(runtime, actionType, payload, linkedStep);

      await this.audit(runtime, "project.copilot.action.executed", {
        actionType,
        approvalMode: "none",
        executionSummary,
      });

      return {
        kind: "action",
        success: true,
        message: `Acción '${actionType}' ejecutada.`,
        approvalMode: "none",
        executedAction: actionType,
        executionSummary,
        refreshTargets,
      };
    } catch (err) {
      return this.buildActionError(runtime, actionType, null, "none", err, refreshTargets);
    }
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  private async handleRefresh(
    runtime: ProjectCopilotHarnessRuntime
  ): Promise<ProjectCopilotHarnessOutput & { kind: "refresh" }> {
    const { actor, projectId } = runtime;

    const [freshWorkspace, freshContext, freshJournal, freshCorpus] = await Promise.all([
      this.resolveWorkspace(actor, projectId),
      this.resolveAgentContext(actor, projectId),
      this.resolveJournal(actor, projectId),
      this.resolveCorpusStatus(actor, projectId),
    ]);
    const freshActivePlanRecord = await this.safeCall(() => this.planExecutionService.getActivePlan({
      tenantId: actor.tenantId,
      projectId,
      evidenceContext: { evidenceCount: freshCorpus.evidenceCount },
    }));
    const freshActivePlan = freshActivePlanRecord
      ? await this.safeCall(() => this.planModeService.getPlanById(actor.tenantId, freshActivePlanRecord.id))
      : null;

    await this.audit(runtime, "project.copilot.refresh", {});

    const actions = this.buildSuggestedActions({
      projectId,
      workspace: freshWorkspace,
      context: freshContext,
      corpusStatus: freshCorpus
    });
    const runs = await this.resolveRecentRuns(actor, projectId);

    // Supervisor mode: spawn specialists in background for next refresh
    const jobId = typeof freshWorkspace?.jobId === "string" ? freshWorkspace.jobId : undefined;
    void this.coordinatorService.runSupervisedAnalysis({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      coordinatorId: "project-copilot",
      projectId,
      jobId,
      requestId: `refresh-${Date.now()}`,
      waitMs: 0, // fire and forget — results will appear in next refresh
    }).catch((err) => this.logger.warn(`[supervisor] background spawn failed: ${String(err)}`));

    return {
      kind: "refresh",
      workspace: freshWorkspace,
      context: freshContext,
      journal: freshJournal,
      corpusStatus: freshCorpus,
      actions,
      runs,
      activePlan: freshActivePlan ?? null,
    };
  }

  // ── Suggested actions ─────────────────────────────────────────────────────

  private buildSuggestedActions(input: {
    projectId: string;
    workspace: ProjectWorkspaceView;
    context: ProjectAgentContextView;
    corpusStatus: CorpusStatusView;
  }): AgentAction[] {
    const actions: AgentAction[] = [];
    const milestonesPending = Math.max(0, input.workspace.milestonesTotal - input.workspace.milestonesApproved);
    const escrowGap = Math.max(0, input.workspace.escrowFunded - input.workspace.escrowReleased);

    if (input.context.openDisputeCount > 0) {
      actions.push(buildAgentAction({
        id: "resolve-open-disputes",
        type: "PROPOSE_DISPUTE_RESOLVE",
        domain: "disputes",
        summary: `Resolver o escalar ${input.context.openDisputeCount} disputa(s) abierta(s)`,
        rationale: `Hay ${input.context.openDisputeCount} disputa(s) activa(s) que bloquean el release de escrow y el avance del proyecto.`,
        requiredInputs: ["disputeId", "resolution"],
        payload: { projectId: input.projectId, openDisputeCount: input.context.openDisputeCount },
        expectedOutcome: "Disputa cerrada. Escrow desbloqueado para release.",
      }));
    }

    if (milestonesPending > 0 && input.corpusStatus.evidenceCount > 0) {
      actions.push(buildAgentAction({
        id: "review-pending-milestones",
        type: "PROPOSE_MILESTONE_APPROVAL",
        domain: "milestones",
        summary: `Revisar ${milestonesPending} milestone(s) pendiente(s) con evidencia disponible`,
        rationale: `Hay ${milestonesPending} milestone(s) en estado submitted con evidencia cargada lista para revisión.`,
        requiredInputs: ["milestoneId"],
        payload: { projectId: input.projectId, milestonesPending },
        expectedOutcome: "Milestone aprobado. Habilita el release de escrow del monto correspondiente.",
      }));
    }

    if (escrowGap > 0 && input.context.openDisputeCount === 0 && input.corpusStatus.evidenceCount > 0) {
      actions.push(buildAgentAction({
        id: "prepare-escrow-release",
        type: "PROPOSE_ESCROW_RELEASE",
        domain: "escrow",
        summary: `Preparar liberación de $${escrowGap.toLocaleString()} retenidos en escrow`,
        rationale: `Hay $${escrowGap.toLocaleString()} disponibles para release. Sin disputas activas y con evidencia indexada.`,
        requiredInputs: ["milestoneId"],
        payload: { projectId: input.projectId, escrowGap },
        expectedOutcome: "Fondos liberados al profesional. Registro de PaymentTxn generado.",
      }));
    }

    if (input.corpusStatus.evidenceCount === 0 && milestonesPending > 0) {
      actions.push(buildAgentAction({
        id: "request-evidence-package",
        type: "REQUEST_MISSING_EVIDENCE",
        domain: "evidence",
        summary: "Solicitar paquete mínimo de evidencia antes de aprobar o liberar",
        rationale: "No hay evidencia indexada. No es posible aprobar milestones ni liberar escrow sin documentación de soporte.",
        requiredInputs: [],
        payload: { projectId: input.projectId },
        expectedOutcome: "Solicitud de evidencia enviada al profesional. Milestone queda en espera.",
      }));
    }

    if (actions.length === 0) {
      actions.push(buildAgentAction({
        id: "assess-operational-state",
        type: "ASSESS_RISK",
        domain: "internal",
        summary: "Revisar estado operativo general y confirmar siguiente paso",
        rationale: "No se detectaron acciones urgentes. Se recomienda revisar el estado global del proyecto.",
        requiredInputs: [],
        payload: { projectId: input.projectId },
        expectedOutcome: "Diagnóstico operativo generado sin modificar estado del proyecto.",
      }));
    }

    return actions;
  }

  private async filterActionsAgainstPlan(
    runtime: ProjectCopilotHarnessRuntime,
    actions: AgentAction[],
  ): Promise<{
    allowed: AgentAction[];
    blocked: Array<{ actionType: string; summary: string; reason: string }>;
  }> {
    const allowed: AgentAction[] = [];
    const blocked: Array<{ actionType: string; summary: string; reason: string }> = [];

    for (const action of actions) {
      const policyDecision = this.agentPolicy.checkActionAllowed({
        actionType: action.type,
        riskLevel: action.riskLevel,
        activePlan: runtime.activePlan,
      });

      if (!policyDecision.allowed) {
        blocked.push({
          actionType: action.type,
          summary: action.summary,
          reason: policyDecision.reason,
        });
        continue;
      }

      const gate = await this.planExecutionService.resolveActionExecution({
        tenantId: runtime.actor.tenantId,
        projectId: runtime.projectId,
        actionType: action.type,
        riskLevel: action.riskLevel,
        evidenceContext: { evidenceCount: runtime.corpusStatus.evidenceCount },
      });

      if (gate.allowed) {
        allowed.push(action);
        continue;
      }

      blocked.push({
        actionType: action.type,
        summary: action.summary,
        reason: gate.reason,
      });
    }

    return { allowed, blocked };
  }

  private async resolveLinkedStep(
    runtime: ProjectCopilotHarnessRuntime,
    actionType: string,
  ): Promise<{ planId: string; stepId: string } | undefined> {
    const knownType = this.resolveActionType(actionType);
    const policy = knownType ? getActionPolicy(knownType) : { riskLevel: "high" as const };
    const gate = await this.planExecutionService.resolveActionExecution({
      tenantId: runtime.actor.tenantId,
      projectId: runtime.projectId,
      actionType,
      riskLevel: policy.riskLevel,
      evidenceContext: { evidenceCount: runtime.corpusStatus.evidenceCount },
    });

    return gate.allowed && gate.plan && gate.step
      ? { planId: gate.plan.id, stepId: gate.step.id }
      : undefined;
  }

  private async executeDisputeOpen(
    runtime: ProjectCopilotHarnessRuntime,
    payload: Record<string, unknown>
  ): Promise<string> {
    const reason =
      typeof payload.reason === "string" && payload.reason.trim().length > 0
        ? payload.reason.trim()
        : "Disputa abierta por copiloto del proyecto tras flujo de aprobación.";

    const dispute = await this.disputesService.create({
      tenantId: runtime.actor.tenantId,
      orgId: runtime.actor.orgId,
      userId: runtime.actor.userId,
      roles: runtime.actor.roles,
      projectId: runtime.projectId,
      reason,
      requestId: runtime.requestId,
    });

    return `Disputa '${dispute.id}' abierta con estado '${dispute.status}'.`;
  }

  // ── Post-approval execution ───────────────────────────────────────────────

  async executeFromApproval(
    actor: AgentActor,
    requestId: string,
    approval: { id: string; contextSummary?: string; correlationId: string }
  ): Promise<{ executed: boolean; summary: string; error?: string }> {
    const context = this.parseContextSummary(approval.contextSummary);
    if (!context) {
      return { executed: false, summary: "No execution context found in approval." };
    }

    const { projectId, actionType, payload, linkedPlanId, linkedStepId } = context;
    const runtime = await this.resolveRuntime(actor, requestId, projectId);

    try {
      const summary = await this.executeApprovedAction(
        runtime,
        actionType,
        payload,
        linkedPlanId && linkedStepId ? { planId: linkedPlanId, stepId: linkedStepId } : undefined,
      );

      await this.audit(runtime, "project.copilot.action.post_approval_executed", {
        approvalId: approval.id,
        actionType,
        executionSummary: summary,
      });

      this.logger.log(`[post-approval] executed action=${actionType} approval=${approval.id} project=${projectId}`);

      return { executed: true, summary };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);

      await this.audit(runtime, "project.copilot.action.post_approval_failed", {
        approvalId: approval.id,
        actionType,
        error,
      });

      this.logger.warn(`[post-approval] failed action=${actionType} approval=${approval.id}: ${error}`);

      return { executed: false, summary: `Ejecución fallida: ${error}`, error };
    }
  }

  private parseContextSummary(
    raw: string | undefined
  ): { projectId: string; actionType: string; payload: Record<string, unknown>; linkedPlanId?: string; linkedStepId?: string } | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.projectId === "string" && typeof parsed.actionType === "string") {
        return {
          projectId: parsed.projectId,
          actionType: parsed.actionType,
          payload: (parsed.payload as Record<string, unknown>) ?? {},
          linkedPlanId: typeof parsed.linkedPlanId === "string" ? parsed.linkedPlanId : undefined,
          linkedStepId: typeof parsed.linkedStepId === "string" ? parsed.linkedStepId : undefined,
        };
      }
    } catch {
      // JSON inválido — no se puede recuperar el contexto
    }
    return null;
  }

  // ── Execution handlers ────────────────────────────────────────────────────

  private async executeApprovedAction(
    runtime: ProjectCopilotHarnessRuntime,
    actionType: string,
    payload: Record<string, unknown>,
    linkedStep?: { planId: string; stepId: string }
  ): Promise<string> {
    const resolvedLink = linkedStep ?? await this.resolveLinkedStep(runtime, actionType);

    if (resolvedLink) {
      await this.planExecutionService.startStep({
        tenantId: runtime.actor.tenantId,
        planId: resolvedLink.planId,
        stepId: resolvedLink.stepId,
        evidenceContext: { evidenceCount: runtime.corpusStatus.evidenceCount },
      });
    }

    try {
      let summary: string;
      switch (actionType) {
        case "PROPOSE_MILESTONE_APPROVAL":
          summary = await this.executeMilestoneApproval(runtime, payload);
          break;
        case "PROPOSE_ESCROW_RELEASE":
          summary = await this.executeEscrowRelease(runtime, payload);
          break;
        case "PROPOSE_DISPUTE_RESOLVE":
          summary = await this.executeDisputeResolution(runtime, payload);
          break;
        case "PROPOSE_DISPUTE_OPEN":
          summary = await this.executeDisputeOpen(runtime, payload);
          break;
        // ── Technical Handlers ──────────────────────────────────────────────
        case "SEARCH_PATTERNS":
          summary = await this.executeSearchPatterns(runtime, payload);
          break;
        case "READ_FILE":
          summary = await this.executeReadFile(runtime, payload);
          break;
        case "LIST_DIRECTORY":
          summary = await this.executeListDirectory(runtime, payload);
          break;
        case "RUN_COMMAND":
          summary = await this.executeRunCommand(runtime, payload);
          break;
        case "RUN_BUILD":
          summary = await this.executeRunCommand(runtime, { command: "npm run build" });
          break;
        case "RUN_TYPECHECK":
          summary = await this.executeRunCommand(runtime, { command: "npm run typecheck" });
          break;
        case "EDIT_FILE":
          summary = await this.executeEditFile(runtime, payload);
          break;
        case "RUN_TESTS":
          summary = await this.executeRunCommand(runtime, { command: "npm test" });
          break;
        case "DELEGATE_TASK":
          summary = await this.executeDelegateTask(runtime, payload);
          break;
        case "REQUEST_AGENT_HELP":
          summary = await this.executeRequestHelp(runtime, payload);
          break;
        default:
          summary = `Sin handler de ejecución registrado para '${actionType}'.`;
          break;
      }

      if (resolvedLink) {
        await this.planExecutionService.completeStep({
          tenantId: runtime.actor.tenantId,
          planId: resolvedLink.planId,
          stepId: resolvedLink.stepId,
          evidenceContext: { evidenceCount: runtime.corpusStatus.evidenceCount },
        });
      }

      return summary;
    } catch (err) {
      if (resolvedLink) {
        const reason = err instanceof Error ? err.message : String(err);
        await this.planExecutionService.failStep({
          tenantId: runtime.actor.tenantId,
          planId: resolvedLink.planId,
          stepId: resolvedLink.stepId,
          reason,
          evidenceContext: { evidenceCount: runtime.corpusStatus.evidenceCount },
        }).catch(() => undefined);
      }
      throw err;
    }
  }

  private async executeMilestoneApproval(
    runtime: ProjectCopilotHarnessRuntime,
    payload: Record<string, unknown>
  ): Promise<string> {
    const milestoneId = await this.resolveMilestoneId(runtime, payload, ["submitted"]);
    const milestone = await this.milestonesService.approve({
      tenantId: runtime.actor.tenantId,
      milestoneId,
      userId: runtime.actor.userId,
      orgId: runtime.actor.orgId,
      roles: runtime.actor.roles,
      requestId: runtime.requestId,
    });

    return `Milestone '${milestone.id}' aprobado con estado '${milestone.status}'.`;
  }

  private async executeEscrowRelease(
    runtime: ProjectCopilotHarnessRuntime,
    payload: Record<string, unknown>
  ): Promise<string> {
    const milestoneId = await this.resolveMilestoneId(runtime, payload, ["approved"]);
    const amount = this.readNumber(payload.amount);
    const result = await this.paymentsService.release({
      tenantId: runtime.actor.tenantId,
      orgId: runtime.actor.orgId,
      userId: runtime.actor.userId,
      roles: runtime.actor.roles,
      milestoneId,
      amount: amount > 0 ? amount : undefined,
      requestId: runtime.requestId,
    });

    return `Release de escrow ejecutado para milestone '${milestoneId}' con transacción '${result.transaction.id}'.`;
  }

  private async executeDisputeResolution(
    runtime: ProjectCopilotHarnessRuntime,
    payload: Record<string, unknown>
  ): Promise<string> {
    const disputeId = await this.resolveDisputeId(runtime, payload);
    const resolution =
      typeof payload.resolution === "string" && payload.resolution.trim().length > 0
        ? payload.resolution.trim()
        : "Resuelto por copiloto del proyecto tras flujo de aprobación.";

    const dispute = await this.disputesService.resolve({
      tenantId: runtime.actor.tenantId,
      orgId: runtime.actor.orgId,
      userId: runtime.actor.userId,
      roles: runtime.actor.roles,
      disputeId,
      resolution,
      requestId: runtime.requestId,
    });

    return `Disputa '${dispute.id}' resuelta con estado '${dispute.status}'.`;
  }

  // ── Technical Handlers implementation ──────────────────────────────────────

  private async executeSearchPatterns(
    _runtime: ProjectCopilotHarnessRuntime,
    payload: Record<string, unknown>
  ): Promise<string> {
    const query = typeof payload.query === "string" ? payload.query : "";
    const path = typeof payload.path === "string" ? payload.path : undefined;
    const matches = await this.technicalRuntime.searchPatterns(query, path);
    return matches.length > 0
      ? `Resultados de búsqueda para '${query}':\n${matches.join("\n")}`
      : `No se encontraron coincidencias para '${query}'.`;
  }

  private async executeReadFile(
    _runtime: ProjectCopilotHarnessRuntime,
    payload: Record<string, unknown>
  ): Promise<string> {
    const path = typeof payload.path === "string" ? payload.path : "";
    const content = await this.technicalRuntime.readTextFile(path);
    return `Contenido de '${path}':\n\n${content.slice(0, 5000)}${content.length > 5000 ? "\n\n... (truncado)" : ""}`;
  }

  private async executeListDirectory(
    _runtime: ProjectCopilotHarnessRuntime,
    payload: Record<string, unknown>
  ): Promise<string> {
    const path = typeof payload.path === "string" ? payload.path : ".";
    const entries = await this.technicalRuntime.listDirectory(path);
    const list = entries.map(e => `${e.isDir ? "[DIR] " : "      "}${e.name}${e.size ? ` (${e.size} bytes)` : ""}`).join("\n");
    return `Directorio '${path}':\n${list}`;
  }

  private async executeRunCommand(
    _runtime: ProjectCopilotHarnessRuntime,
    payload: Record<string, unknown>
  ): Promise<string> {
    const command = typeof payload.command === "string" ? payload.command : "";
    const result = await this.technicalRuntime.runCommand(command);
    let summary = `Ejecución de '${command}' (exit ${result.exitCode}):\n\nSTDOUT:\n${result.stdout || "(vacío)"}`;
    if (result.stderr) {
      summary += `\n\nSTDERR:\n${result.stderr}`;
    }
    return summary.slice(0, 8000);
  }

  private async executeEditFile(
    _runtime: ProjectCopilotHarnessRuntime,
    payload: Record<string, unknown>
  ): Promise<string> {
    const path = typeof payload.path === "string" ? payload.path : "";
    const content = typeof payload.content === "string" ? payload.content : "";
    await this.technicalRuntime.writeTextFile(path, content);
    return `Archivo '${path}' actualizado con ${content.length} bytes.`;
  }

  private async executeDelegateTask(
    runtime: ProjectCopilotHarnessRuntime,
    payload: Record<string, unknown>
  ): Promise<string> {
    const role = typeof payload.agentRole === "string" ? payload.agentRole : "unknown";
    const task = typeof payload.task === "string" ? payload.task : "";
    const context = payload.context && typeof payload.context === "object" ? payload.context : {};

    const { delegation, run } = await this.agentDelegationService.delegateTask({
      tenantId: runtime.actor.tenantId,
      orgId: runtime.actor.orgId,
      userId: runtime.actor.userId,
      roles: runtime.actor.roles,
      projectId: runtime.projectId,
      sourceRunId: undefined, // El harness no siempre corre bajo un run explícito en este modelo, pero podríamos vincularlo si existiera
      coordinatorId: "project-copilot",
      targetAgentId: role,
      taskTitle: task,
      taskContextJson: context as Record<string, unknown>,
      requestId: runtime.requestId,
    });

    return `Tarea delegada exitosamente a '${role}' (Delegation ID: ${delegation.id}). El agente '${role}' ejecutará la tarea en segundo plano (Run ID: ${run.id}).`;
  }

  private async executeRequestHelp(
    _runtime: ProjectCopilotHarnessRuntime,
    payload: Record<string, unknown>
  ): Promise<string> {
    const agentId = typeof payload.agentId === "string" ? payload.agentId : "assistant";
    const question = typeof payload.question === "string" ? payload.question : "";
    return `Consulta enviada a '${agentId}': ${question}. Esperando respuesta del agente especializado.`;
  }

  // ── Approval helpers ──────────────────────────────────────────────────────

  private async registerApprovalRequest(
    runtime: ProjectCopilotHarnessRuntime,
    actionType: string,
    payload: Record<string, unknown>,
    riskLevel: "low" | "medium" | "high",
    linkedStep?: { planId: string; stepId: string }
  ) {
    const request = this.buildApprovalRequest(runtime, actionType, payload, riskLevel, ["ops_admin"], linkedStep);
    const [approval] = await this.agentApprovalService.register({
      tenantId: runtime.actor.tenantId,
      orgId: runtime.actor.orgId,
      userId: runtime.actor.userId,
      requestId: runtime.requestId,
      approvals: [request],
    });
    return approval;
  }

  private async registerAndAutoApprove(
    runtime: ProjectCopilotHarnessRuntime,
    actionType: string,
    payload: Record<string, unknown>,
    riskLevel: "low" | "medium" | "high",
    linkedStep: { planId: string; stepId: string } | undefined,
    comment: string
  ) {
    const request = this.buildApprovalRequest(runtime, actionType, payload, riskLevel, ["system_autoapprove"], linkedStep);
    const [approval] = await this.agentApprovalService.register({
      tenantId: runtime.actor.tenantId,
      orgId: runtime.actor.orgId,
      userId: runtime.actor.userId,
      requestId: runtime.requestId,
      approvals: [request],
    });

    return this.agentApprovalService.decide({
      tenantId: runtime.actor.tenantId,
      orgId: runtime.actor.orgId,
      userId: runtime.actor.userId,
      approvalId: approval.id,
      decision: "approved",
      comment,
      requestId: runtime.requestId,
    });
  }

  private buildApprovalRequest(
    runtime: ProjectCopilotHarnessRuntime,
    actionType: string,
    payload: Record<string, unknown>,
    riskLevel: "low" | "medium" | "high",
    requiredApprovals: string[],
    linkedStep?: { planId: string; stepId: string }
  ): AgentApprovalRequest {
    const riskScore = riskLevel === "high" ? 0.85 : riskLevel === "medium" ? 0.55 : 0.2;
    return {
      id: `apr_copilot_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      runId: `copilot_action_${runtime.projectId}_${Date.now()}`,
      correlationId: `copilot:${runtime.projectId}:${actionType}:${Date.now()}`,
      agentType: "orchestrator",
      title: `Copilot action ${actionType}`,
      reason: `Execute project copilot action '${actionType}' for project '${runtime.projectId}'`,
      status: "pending",
      riskLevel,
      riskScore,
      requestedAt: new Date().toISOString(),
      policyDecision: "require_approval",
      requiredApprovals,
      contextSummary: JSON.stringify({
        projectId: runtime.projectId,
        actionType,
        payload,
        linkedPlanId: linkedStep?.planId,
        linkedStepId: linkedStep?.stepId,
      }),
    };
  }

  private buildActionError(
    runtime: ProjectCopilotHarnessRuntime,
    actionType: string,
    approval: { id: string; status: "pending" | "approved" | "rejected" } | null,
    approvalMode: "none" | "recommended" | "required",
    err: unknown,
    refreshTargets: RefreshTarget[]
  ): ProjectCopilotHarnessOutput & { kind: "action" } {
    const errorMessage = err instanceof Error ? err.message : String(err);

    void this.audit(runtime, "project.copilot.action.execution_failed", {
      actionType,
      approvalId: approval?.id,
      approvalMode,
      error: errorMessage,
    });

    return {
      kind: "action",
      success: false,
      message: `Acción '${actionType}' falló durante ejecución: ${errorMessage}`,
      approvalId: approval?.id,
      approvalStatus: approval?.status,
      approvalMode,
      executedAction: actionType,
      executionSummary: errorMessage,
      refreshTargets,
    };
  }

  // ── Resolution helpers ────────────────────────────────────────────────────

  private resolveActionType(raw: string): AgentActionType | null {
    const result = agentActionTypeSchema.safeParse(raw);
    return result.success ? result.data : null;
  }

  private async resolveRecentRuns(actor: AgentActor, projectId: string) {
    try {
      const runs = await this.agentsService.list({
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        userId: actor.userId,
      });
      return runs
        .filter((run: Record<string, unknown>) => {
           // Si el run tiene context de operador y el workspace coincide con project:ID,
           // o si en el input está el projectId, lo incluimos.
           const input = run.input as Record<string, unknown> | undefined;
           const opContext = input?.operatorContext as Record<string, unknown> | undefined;
           if (opContext && opContext.workspaceId === `project:${projectId}`) return true;
           if (input && input.projectId === projectId) return true;
           if (input && input.delegationId) return true; // Include delegated sub-runs
           return false;
        })
        .map((run: Record<string, unknown>) => ({
          id: String(run.id ?? ""),
          agentType: String(run.agentType ?? ""),
          status: String(run.status ?? ""),
          startedAt: String(run.startedAt ?? new Date().toISOString()),
          finishedAt: run.endedAt ? String(run.endedAt) : undefined,
          durationMs: typeof run.durationMs === "number" ? run.durationMs : undefined,
          toolCallCount: typeof run.toolCallCount === "number" ? run.toolCallCount : 0,
        }))
        .slice(0, 10); // Exponer solo los más recientes
    } catch {
      return [];
    }
  }

  private async resolveMilestoneId(
    runtime: ProjectCopilotHarnessRuntime,
    payload: Record<string, unknown>,
    allowedStatuses: Array<"submitted" | "approved">
  ): Promise<string> {
    if (typeof payload.milestoneId === "string" && payload.milestoneId.trim().length > 0) {
      return payload.milestoneId;
    }

    const milestones = await this.milestonesRepository.listByProject({
      tenantId: runtime.actor.tenantId,
      projectId: runtime.projectId,
      userId: runtime.actor.userId,
      orgId: runtime.actor.orgId,
      roles: runtime.actor.roles,
    });

    const match = milestones.find((item) => allowedStatuses.includes(item.status as "submitted" | "approved"));
    if (!match) {
      throw new Error(`No eligible milestone found for action on project '${runtime.projectId}'.`);
    }

    return match.id;
  }

  private async resolveDisputeId(
    runtime: ProjectCopilotHarnessRuntime,
    payload: Record<string, unknown>
  ): Promise<string> {
    if (typeof payload.disputeId === "string" && payload.disputeId.trim().length > 0) {
      return payload.disputeId;
    }

    const disputes = await this.disputesRepository.list({
      tenantId: runtime.actor.tenantId,
      orgId: runtime.actor.orgId,
      userId: runtime.actor.userId,
      roles: runtime.actor.roles,
    });

    const match = disputes.find((item) => item.projectId === runtime.projectId && item.status !== "resolved");
    if (!match) {
      throw new Error(`No open dispute found for project '${runtime.projectId}'.`);
    }

    return match.id;
  }

  private async audit(
    runtime: ProjectCopilotHarnessRuntime,
    action: string,
    detail: Record<string, unknown>
  ): Promise<void> {
    const { actor, requestId, projectId } = runtime;
    try {
      await this.auditService.append({
        id: `aud_copilot_${Date.now()}`,
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        actorUserId: actor.userId,
        action,
        entityType: "ProjectCopilot",
        entityId: projectId,
        requestId,
        timestamp: new Date().toISOString(),
        afterJson: detail,
      });
    } catch (err) {
      this.logger.warn(`Audit failed for ${action}: ${String(err)}`);
    }
  }

  private async safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch {
      return null;
    }
  }

  private readNumber(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }
}
