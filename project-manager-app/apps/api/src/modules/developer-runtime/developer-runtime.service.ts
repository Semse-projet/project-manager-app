import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  DeveloperRuntimeApprovalRecord,
  DeveloperRuntimeArtifact,
  DeveloperRuntimeApprovalResponseInput,
  DeveloperRuntimeCreateMissionInput,
  DeveloperRuntimeCreateSessionInput,
  DeveloperRuntimeExecuteSessionInput,
  DeveloperRuntimeExecutionStep,
  DeveloperRuntimeIntentTask,
  DeveloperRuntimeMission,
  DeveloperRuntimeSession,
  DeveloperRuntimeSessionLog,
  DeveloperRuntimeTaskCategory,
  DeveloperRuntimeValidationResult,
  DeveloperRuntimeWorkerCompleteInput,
  DeveloperRuntimeWorkerFailInput,
  DeveloperRuntimeWorkerStartInput,
} from "@semse/schemas";
import {
  DEVELOPER_RUNTIME_AGENTS,
  type DeveloperRuntimeAgentRole,
} from "@semse/agents";
import {
  SEMSE_DEVELOPER_RUNTIME_AUTONOMY_ORDER,
  SEMSE_DEVELOPER_RUNTIME_COMMAND_TEMPLATES,
  SEMSE_DEVELOPER_RUNTIME_COMMAND_TEMPLATE_POLICIES,
  SEMSE_DEVELOPER_RUNTIME_EVENTS,
} from "@semse/shared";
import { DeveloperRuntimeApprovalService } from "./developer-runtime.approval.service.js";
import { DeveloperRuntimeQueueService } from "../../infrastructure/queue/developer-runtime-queue.service.js";
import { DeveloperRuntimeRepository } from "./developer-runtime.repository.js";
import { DeveloperRuntimeShellService } from "./developer-runtime.shell.service.js";
import { DeveloperRuntimeValidationService } from "./developer-runtime.validation.service.js";

function nowIso() {
  return new Date().toISOString();
}

function buildPlanForCategory(intent: DeveloperRuntimeIntentTask): DeveloperRuntimeExecutionStep[] {
  const stepsByCategory: Record<DeveloperRuntimeTaskCategory, Array<{
    title: string;
    description: string;
    tool: DeveloperRuntimeExecutionStep["tool"];
    agent: DeveloperRuntimeAgentRole;
    riskLevel: DeveloperRuntimeExecutionStep["riskLevel"];
    approvalRequired: boolean;
    verificationRule?: string;
  }>> = {
    bootstrap: [
      { title: "Inspect repo", description: "Inspect repository structure, package manager and runtime prerequisites.", tool: "listFiles", agent: "diagnostic-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Repository structure summarized" },
      { title: "Inspect env", description: "Review missing environment variables and local runtime prerequisites.", tool: "inspectEnv", agent: "runtime-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Environment summary produced" },
      { title: "Install dependencies", description: "Install or repair dependencies required to bootstrap the repo.", tool: "installDependencies", agent: "runtime-agent", riskLevel: "medium", approvalRequired: true, verificationRule: "Dependency install exitCode is 0" },
      { title: "Run build", description: "Run build as first validation gate.", tool: "runBuild", agent: "qa-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Build passes" },
    ],
    diagnostic: [
      { title: "Inspect repo", description: "Inspect target area, files and structural signals.", tool: "searchCode", agent: "diagnostic-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Relevant files identified" },
      { title: "Run validation", description: "Run the most relevant validation command to reproduce the issue.", tool: "runBuild", agent: "qa-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Failure reproduced or build passes" },
      { title: "Summarize findings", description: "Summarize likely causes and recommended next actions.", tool: "readFile", agent: "architect-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Diagnosis emitted" },
    ],
    bugfix: [
      { title: "Reproduce failure", description: "Run the failing workflow and capture the error surface.", tool: "runBuild", agent: "qa-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Failure reproduced" },
      { title: "Locate source", description: "Search and inspect the code path causing the failure.", tool: "searchCode", agent: "diagnostic-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Impacted files identified" },
      { title: "Patch code", description: "Apply a focused patch to fix the issue.", tool: "patchFile", agent: "backend-agent", riskLevel: "medium", approvalRequired: true, verificationRule: "Patch applied" },
      { title: "Re-run validation", description: "Run the relevant validation again after the patch.", tool: "runTests", agent: "qa-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Validation passes" },
    ],
    refactor: [
      { title: "Map boundary", description: "Inspect dependencies, ownership and change boundary.", tool: "searchCode", agent: "architect-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Refactor boundary identified" },
      { title: "Patch implementation", description: "Apply the refactor in controlled scope.", tool: "patchFile", agent: "backend-agent", riskLevel: "medium", approvalRequired: true, verificationRule: "Refactor patch applied" },
      { title: "Run lint", description: "Validate style and local integration after refactor.", tool: "runLint", agent: "qa-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Lint passes" },
    ],
    generate: [
      { title: "Locate target module", description: "Find the canonical ownership boundary for the generated code.", tool: "searchCode", agent: "architect-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Target module identified" },
      { title: "Write files", description: "Generate files and exports in the selected module.", tool: "writeFile", agent: "backend-agent", riskLevel: "medium", approvalRequired: true, verificationRule: "Files created" },
      { title: "Run build", description: "Validate the generated output compiles.", tool: "runBuild", agent: "qa-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Build passes" },
    ],
    validate: [
      { title: "Run build", description: "Run compile/build validation.", tool: "runBuild", agent: "qa-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Build passes or failure captured" },
      { title: "Run lint", description: "Run lint validation.", tool: "runLint", agent: "qa-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Lint passes or failure captured" },
      { title: "Run tests", description: "Run tests validation.", tool: "runTests", agent: "qa-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Tests pass or failure captured" },
    ],
    deploy: [
      { title: "Inspect deployment context", description: "Inspect deployment target and prerequisites.", tool: "inspectEnv", agent: "devops-agent", riskLevel: "medium", approvalRequired: true, verificationRule: "Deployment context summarized" },
      { title: "Prepare deployment", description: "Prepare deployment command and config changes.", tool: "runCommand", agent: "devops-agent", riskLevel: "high", approvalRequired: true, verificationRule: "Deployment command prepared" },
      { title: "Validate health", description: "Validate health checks after deployment.", tool: "runTests", agent: "qa-agent", riskLevel: "medium", approvalRequired: true, verificationRule: "Health checks pass" },
    ],
    document: [
      { title: "Inspect changes", description: "Inspect files and diffs that require documentation.", tool: "gitDiff", agent: "doc-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Relevant changes identified" },
      { title: "Write documentation", description: "Update docs, ADR or changelog for the mission.", tool: "writeFile", agent: "doc-agent", riskLevel: "low", approvalRequired: true, verificationRule: "Documentation updated" },
      { title: "Review alignment", description: "Review that documentation matches the implemented state.", tool: "readFile", agent: "architect-agent", riskLevel: "low", approvalRequired: false, verificationRule: "Documentation reviewed" },
    ],
  };

  const plan = stepsByCategory[intent.category];
  return plan.map((step, index) => ({
    id: randomUUID(),
    missionId: "",
    title: step.title,
    description: step.description,
    tool: step.tool,
    agent: step.agent,
    order: index,
    riskLevel: step.riskLevel,
    approvalRequired: step.approvalRequired,
    verificationRule: step.verificationRule,
    status: "pending",
  }));
}

@Injectable()
export class DeveloperRuntimeService {
  constructor(
    private readonly repository: DeveloperRuntimeRepository,
    private readonly approvalService: DeveloperRuntimeApprovalService,
    private readonly queueService: DeveloperRuntimeQueueService,
    private readonly shellService: DeveloperRuntimeShellService,
    private readonly validationService: DeveloperRuntimeValidationService,
  ) {}

  async listSessions(input: {
    actor: { tenantId: string; orgId: string; userId: string };
    filters?: { repoId?: string; state?: DeveloperRuntimeSession["state"] };
  }) {
    return this.repository.listSessions(input);
  }

  async createSession(
    input: DeveloperRuntimeCreateSessionInput,
    actor: { tenantId: string; orgId: string; userId: string },
    requestId: string,
  ): Promise<DeveloperRuntimeSession> {
    const sessionId = randomUUID();
    const missionId = randomUUID();
    const session: DeveloperRuntimeSession = {
      id: sessionId,
      userId: actor.userId,
      repoId: input.repoId,
      branch: input.branch,
      startedAt: nowIso(),
      goal: input.goal,
      state: "planning",
      selectedAgents: input.selectedAgents,
      missionId,
    };

    return this.repository.createSession({
      actor,
      requestId,
      session,
    });
  }

  async getSession(
    sessionId: string,
    actor: { tenantId: string; orgId: string; userId: string },
  ) {
    return this.repository.getSession({
      actor,
      sessionId,
    });
  }

  async createMission(
    sessionId: string,
    input: DeveloperRuntimeCreateMissionInput,
    actor: { tenantId: string; orgId: string; userId: string },
    requestId: string,
  ): Promise<DeveloperRuntimeMission> {
    const { session } = await this.repository.getSession({
      actor,
      sessionId,
    });

    const intent: DeveloperRuntimeIntentTask = {
      id: randomUUID(),
      ...input.intent,
    };

    const missionId = session.missionId;
    const plan = buildPlanForCategory(intent).map((step) => ({
      ...step,
      missionId,
      approvalRequired: this.approvalService.evaluateStep(step).approvalRequired,
    }));
    const validationPreview = this.validationService.buildPreview({
      id: missionId,
      sessionId,
      intent,
      plan,
      riskLevel: intent.riskLevel,
      status: "draft",
    });
    const planningLogs = this.validationService.buildPlanningLogs({
      id: missionId,
      sessionId,
      intent,
      plan,
      riskLevel: intent.riskLevel,
      status: "draft",
    });
    const planningArtifacts = this.validationService.buildPlanningArtifacts({
      id: missionId,
      sessionId,
      intent,
      plan,
      riskLevel: intent.riskLevel,
      status: "draft",
    });

    const mission: DeveloperRuntimeMission = {
      id: missionId,
      sessionId,
      intent,
      plan,
      riskLevel: intent.riskLevel,
      status: "draft",
    };
    const approvals = this.approvalService.buildApprovalRequests({
      sessionId,
      plan,
    }).map((request) => ({ request }));

    const updatedSession: DeveloperRuntimeSession = {
      ...session,
      state: approvals.length > 0 ? "awaiting_approval" : "planning",
      selectedAgents: Array.from(new Set(plan.map((step) => step.agent))),
      summary: `Mission planned for ${intent.category} · validations: ${validationPreview.map((entry) => entry.name).join(", ")}`,
    };

    return this.repository.saveMission({
      actor,
      requestId,
      session: updatedSession,
      mission,
      logs: planningLogs,
      validations: validationPreview,
      artifacts: planningArtifacts,
      approvals,
    });
  }

  getCatalog() {
    return {
      autonomyLevels: SEMSE_DEVELOPER_RUNTIME_AUTONOMY_ORDER,
      events: SEMSE_DEVELOPER_RUNTIME_EVENTS,
      agents: Object.values(DEVELOPER_RUNTIME_AGENTS),
      tools: this.shellService.getSupportedTools(),
      commandTemplates: SEMSE_DEVELOPER_RUNTIME_COMMAND_TEMPLATES,
      commandTemplatePolicies: SEMSE_DEVELOPER_RUNTIME_COMMAND_TEMPLATE_POLICIES,
    };
  }

  async executeSession(
    sessionId: string,
    input: DeveloperRuntimeExecuteSessionInput,
    actor: { tenantId: string; orgId: string; userId: string },
    requestId: string,
  ) {
    const detail = await this.repository.getSession({ actor, sessionId });
    if (!detail.mission) {
      throw new Error(`Developer runtime session ${sessionId} has no mission to execute`);
    }
    const pendingApprovals = detail.approvals.filter((approval) => approval.request && !approval.decision);
    if (pendingApprovals.length > 0) {
      throw new BadRequestException(`Developer runtime session ${sessionId} still has ${pendingApprovals.length} pending approvals`);
    }
    const rejectedApprovals = detail.approvals.filter((approval) => approval.decision && !approval.decision.approved);
    if (rejectedApprovals.length > 0) {
      throw new BadRequestException(`Developer runtime session ${sessionId} has ${rejectedApprovals.length} rejected approvals and cannot execute`);
    }

    const session: DeveloperRuntimeSession = {
      ...detail.session,
      state: "executing",
      summary: "Mission dispatched to worker.",
    };
    const mission: DeveloperRuntimeMission = {
      ...detail.mission,
      status: "running",
    };
    const dispatchLog: DeveloperRuntimeSessionLog = {
      id: randomUUID(),
      sessionId,
      timestamp: nowIso(),
      agent: "runtime-agent",
      tool: "runCommand",
      action: "mission.dispatched",
      inputSummary: `Mission ${mission.id} queued for worker execution.`,
      outputSummary: input.cwd ? `Execution requested with cwd ${input.cwd}.` : "Execution requested with default cwd.",
      status: "ok",
    };

    await this.repository.saveExecutionUpdate({
      actor,
      requestId,
      session,
      mission,
      logs: [dispatchLog],
      sessionAction: "developer_runtime.session.executing",
      missionAction: "developer_runtime.mission.running",
    });

    await this.queueService.enqueueExecution({
      sessionId,
      missionId: mission.id,
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      repoId: session.repoId,
      cwd: input.cwd,
    });

    return this.repository.getSession({ actor, sessionId });
  }

  async respondApproval(
    sessionId: string,
    approvalId: string,
    input: DeveloperRuntimeApprovalResponseInput,
    actor: { tenantId: string; orgId: string; userId: string },
    requestId: string,
  ) {
    const detail = await this.repository.getSession({ actor, sessionId });
    if (!detail.mission) {
      throw new Error(`Developer runtime session ${sessionId} has no mission`);
    }

    const target = detail.approvals.find((approval) => approval.request.id === approvalId);
    if (!target) {
      throw new BadRequestException(`Approval ${approvalId} not found for session ${sessionId}`);
    }
    if (target.decision) {
      throw new BadRequestException(`Approval ${approvalId} is already resolved`);
    }

    const resolvedApproval: DeveloperRuntimeApprovalRecord = {
      request: target.request,
      decision: this.approvalService.buildDecision({
        requestId: target.request.id,
        approved: input.approved,
        decidedBy: actor.userId,
        comment: input.comment,
      }),
    };
    if (!resolvedApproval.decision) {
      throw new BadRequestException(`Approval ${approvalId} could not be resolved`);
    }
    const decision = resolvedApproval.decision;
    const approvals = detail.approvals.map((approval) => (
      approval.request.id === approvalId ? resolvedApproval : approval
    ));
    const stillPending = approvals.some((approval) => !approval.decision);
    const session: DeveloperRuntimeSession = {
      ...detail.session,
      state: stillPending ? "awaiting_approval" : "planning",
      summary: stillPending
        ? "Mission waiting for remaining approvals."
        : "All required approvals resolved. Mission ready for execution.",
    };
    const log: DeveloperRuntimeSessionLog = {
      id: randomUUID(),
      sessionId,
      timestamp: decision.decidedAt,
      agent: "governance-agent",
      tool: "requestApproval",
      action: input.approved ? "approval.approved" : "approval.rejected",
      inputSummary: target.request.actionPreview,
      outputSummary: input.comment ?? (input.approved ? "Approved for execution." : "Rejected pending manual review."),
      status: input.approved ? "ok" : "warning",
    };

    await this.repository.saveExecutionUpdate({
      actor,
      requestId,
      session,
      mission: detail.mission,
      logs: [log],
      approvals: [resolvedApproval],
      sessionAction: "developer_runtime.session.approval_updated",
      missionAction: "developer_runtime.mission.approval_updated",
    });

    return this.repository.getSession({ actor, sessionId });
  }

  async startWorkerExecution(
    sessionId: string,
    input: DeveloperRuntimeWorkerStartInput,
    actor: { tenantId: string; orgId: string; userId: string },
    requestId: string,
  ) {
    const detail = await this.repository.getSession({ actor, sessionId });
    if (!detail.mission) {
      throw new Error(`Developer runtime session ${sessionId} has no mission to execute`);
    }

    const log: DeveloperRuntimeSessionLog = {
      id: randomUUID(),
      sessionId,
      timestamp: input.startedAt ?? nowIso(),
      agent: "runtime-agent",
      tool: "runCommand",
      action: "worker.started",
      inputSummary: `Worker ${input.workerId} picked mission ${detail.mission.id}.`,
      outputSummary: "Execution started in worker.",
      status: "ok",
    };

    return this.repository.saveExecutionUpdate({
      actor,
      requestId,
      session: {
        ...detail.session,
        state: "executing",
      },
      mission: {
        ...detail.mission,
        status: "running",
      },
      logs: [log],
      sessionAction: "developer_runtime.session.worker_started",
      missionAction: "developer_runtime.mission.worker_started",
    });
  }

  async appendProgressLog(
    sessionId: string,
    log: DeveloperRuntimeSessionLog,
    actor: { tenantId: string; orgId: string; userId: string },
  ) {
    await this.repository.appendProgressLog({
      actor,
      sessionId,
      log,
    });
    return { ok: true };
  }

  async completeWorkerExecution(
    sessionId: string,
    input: DeveloperRuntimeWorkerCompleteInput,
    actor: { tenantId: string; orgId: string; userId: string },
    requestId: string,
  ) {
    return this.repository.saveExecutionUpdate({
      actor,
      requestId,
      session: input.session,
      mission: input.mission,
      logs: input.logs,
      validations: input.validations,
      artifacts: input.artifacts,
      sessionAction: "developer_runtime.session.completed",
      missionAction: "developer_runtime.mission.completed",
    });
  }

  async failWorkerExecution(
    sessionId: string,
    input: DeveloperRuntimeWorkerFailInput,
    actor: { tenantId: string; orgId: string; userId: string },
    requestId: string,
  ) {
    const failureLog: DeveloperRuntimeSessionLog = {
      id: randomUUID(),
      sessionId,
      timestamp: nowIso(),
      agent: "runtime-agent",
      tool: "runCommand",
      action: "worker.failed",
      inputSummary: `Worker ${input.workerId} failed mission ${input.mission.id}.`,
      outputSummary: input.error,
      status: "error",
    };

    return this.repository.saveExecutionUpdate({
      actor,
      requestId,
      session: input.session,
      mission: input.mission,
      logs: [...input.logs, failureLog],
      validations: input.validations,
      artifacts: input.artifacts,
      sessionAction: "developer_runtime.session.failed",
      missionAction: "developer_runtime.mission.failed",
    });
  }
}
