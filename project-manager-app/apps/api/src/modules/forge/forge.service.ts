import { randomUUID } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { canTransitionForgeRun, ForgeHarness } from "@semse/forge";
import type {
  ForgeAgentRole,
  ForgeApprovalMode,
  ForgePolicyResult,
  ForgePRPackage,
  ForgeRun,
  ForgeRunState,
  ForgeSpecReference,
  ForgeTaskPacket
} from "@semse/forge";
import type { AgentRunRecord } from "../../common/domain-store.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { ForgeAgentAdapterService } from "./forge-agent-adapter.service.js";
import { ForgeRepository } from "./forge.repository.js";

export type ForgeActor = { tenantId: string; orgId: string; userId: string; roles?: string[] };

@Injectable()
export class ForgeService {
  constructor(
    private readonly repository: ForgeRepository,
    private readonly adapter: ForgeAgentAdapterService,
    private readonly auditService: AuditService
  ) {}

  async list(tenantId: string): Promise<ForgeRun[]> {
    return this.repository.list(tenantId);
  }

  async findById(input: { tenantId: string; runId: string }): Promise<ForgeRun> {
    return this.repository.findById(input);
  }

  async create(input: {
    actor: ForgeActor;
    title: string;
    spec: ForgeSpecReference;
    requestId: string;
  }): Promise<ForgeRun> {
    const harness = new ForgeHarness();
    const run = harness.createRun({ title: input.title, spec: input.spec, actor: input.actor.userId });
    const persisted = await this.repository.create({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      userId: input.actor.userId,
      run
    });
    await this.auditService.append({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      actorUserId: input.actor.userId,
      action: "forge.run.create",
      entityType: "ForgeRun",
      entityId: persisted.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: { state: persisted.state, specId: persisted.spec.id }
    });
    return persisted;
  }

  async transition(input: {
    actor: ForgeActor;
    runId: string;
    next: ForgeRunState;
    requestId: string;
  }): Promise<ForgeRun> {
    const current = await this.repository.findById({ tenantId: input.actor.tenantId, runId: input.runId });
    const harness = this.load(current);
    const updated = harness.transition(input.runId, input.next, input.actor.userId);
    const persisted = await this.repository.update({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      userId: input.actor.userId,
      run: updated
    });
    await this.auditService.append({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      actorUserId: input.actor.userId,
      action: "forge.run.transition",
      entityType: "ForgeRun",
      entityId: persisted.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: { state: persisted.state }
    });
    return persisted;
  }

  async addTask(input: {
    actor: ForgeActor;
    runId: string;
    task: ForgeTaskPacket;
    requestId: string;
  }): Promise<ForgeRun> {
    const current = await this.repository.findById({ tenantId: input.actor.tenantId, runId: input.runId });
    const harness = this.load(current);
    const updated = harness.addTask(input.runId, input.task);
    const persisted = await this.repository.update({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      userId: input.actor.userId,
      run: updated
    });
    await this.auditService.append({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      actorUserId: input.actor.userId,
      action: "forge.task.add",
      entityType: "ForgeRun",
      entityId: persisted.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: { taskId: input.task.id, requestedRole: input.task.requestedRole }
    });
    return persisted;
  }

  async assignTask(input: {
    actor: ForgeActor;
    runId: string;
    taskId: string;
    role: ForgeAgentRole;
    requestId: string;
  }): Promise<ForgeRun> {
    const current = await this.repository.findById({ tenantId: input.actor.tenantId, runId: input.runId });
    const harness = this.load(current);
    const updated = harness.assignTask(input.runId, input.taskId, input.role);
    const persisted = await this.repository.update({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      userId: input.actor.userId,
      run: updated
    });
    await this.auditService.append({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      actorUserId: input.actor.userId,
      action: "forge.task.assign",
      entityType: "ForgeRun",
      entityId: persisted.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: { taskId: input.taskId, role: input.role }
    });
    return persisted;
  }

  async executeTask(input: {
    actor: ForgeActor;
    runId: string;
    taskId: string;
    action?: string;
    async?: boolean;
    requestId: string;
  }): Promise<
    | { forgeRun: ForgeRun; agentRun: AgentRunRecord; result: Record<string, unknown> }
    | { forgeRun: ForgeRun; agentRun: AgentRunRecord }
  > {
    const current = await this.repository.findById({ tenantId: input.actor.tenantId, runId: input.runId });
    const task = current.tasks.find((candidate) => candidate.id === input.taskId);
    if (!task) {
      throw new NotFoundException(`Forge task '${input.taskId}' not found`);
    }

    const harness = this.load(current);
    harness.assignTask(input.runId, input.taskId, task.requestedRole);

    if (input.async) {
      if (canTransitionForgeRun(current.state, "building")) {
        harness.transition(input.runId, "building", input.actor.userId);
      }

      const agentRun = await this.adapter.enqueue({
        actor: input.actor,
        forgeRun: current,
        task,
        action: input.action,
        requestId: input.requestId
      });

      const updated = harness.getRun(input.runId);
      if (!updated.agentRunIds.includes(agentRun.id)) {
        updated.agentRunIds.push(agentRun.id);
      }
      updated.events.push({
        id: randomUUID(),
        type: "FORGE_TASK_QUEUED",
        runId: updated.id,
        timestamp: new Date().toISOString(),
        actor: input.actor.userId,
        detail: { taskId: input.taskId, agentRunId: agentRun.id }
      } as const);

      const persisted = await this.repository.update({
        tenantId: input.actor.tenantId,
        orgId: input.actor.orgId,
        userId: input.actor.userId,
        run: updated
      });

      await this.auditService.append({
        tenantId: input.actor.tenantId,
        orgId: input.actor.orgId,
        actorUserId: input.actor.userId,
        action: "forge.task.enqueue",
        entityType: "ForgeRun",
        entityId: persisted.id,
        requestId: input.requestId,
        timestamp: new Date().toISOString(),
        afterJson: { taskId: input.taskId, agentRunId: agentRun.id }
      });

      return { forgeRun: persisted, agentRun };
    }

    const { agentRun, result } = await this.adapter.execute({
      actor: input.actor,
      forgeRun: harness.getRun(input.runId),
      task,
      action: input.action
    });

    const forgeRun = await this.applyTaskResult({
      actor: input.actor,
      current: harness.getRun(input.runId),
      task,
      agentRunId: agentRun.id,
      result,
      requestId: input.requestId
    });

    return { forgeRun, agentRun, result: result as unknown as Record<string, unknown> };
  }

  async completeTask(input: {
    actor: ForgeActor;
    runId: string;
    taskId: string;
    agentRunId: string;
    result: Record<string, unknown>;
    requestId: string;
  }): Promise<ForgeRun> {
    const current = await this.repository.findById({ tenantId: input.actor.tenantId, runId: input.runId });
    const task = current.tasks.find((candidate) => candidate.id === input.taskId);
    if (!task) {
      throw new NotFoundException(`Forge task '${input.taskId}' not found`);
    }

    if (!current.agentRunIds.includes(input.agentRunId)) {
      return this.applyTaskResult({
        actor: input.actor,
        current,
        task,
        agentRunId: input.agentRunId,
        result: input.result,
        requestId: input.requestId
      });
    }

    return current;
  }

  private async applyTaskResult(input: {
    actor: ForgeActor;
    current: ForgeRun;
    task: ForgeTaskPacket;
    agentRunId: string;
    result: Record<string, unknown>;
    requestId: string;
  }): Promise<ForgeRun> {
    const { actor, current, task, agentRunId, result, requestId } = input;
    const harness = this.load(current);

    const payload = typeof result.payload === "object" && result.payload !== null
      ? (result.payload as Record<string, unknown>)
      : {};
    const resultPolicy = payload.policy ?? (result as Record<string, unknown>).policy;
    const policy = typeof resultPolicy === "object" && resultPolicy !== null
      ? (resultPolicy as ForgePolicyResult)
      : undefined;
    const action = typeof payload.action === "string"
      ? payload.action
      : (input.task.allowedCommands[0] ?? "runtime.execute");

    harness.authorizeTaskAction({
      runId: current.id,
      taskId: task.id,
      role: task.requestedRole,
      action
    });

    const prPackage = payload.prPackage as ForgePRPackage | undefined;

    let nextState = current.state;
    if (policy?.decision === "deny" || prPackage?.decision === "deny") {
      nextState = "blocked";
    } else if (prPackage) {
      nextState = current.state === "building" || current.state === "verifying" ? "ready_for_review" : current.state;
    } else if (policy?.decision === "require_approval") {
      nextState = nextState === "building" ? nextState : "ready_for_review";
    }

    if (nextState === "ready_for_review" && current.state === "building") {
      harness.transition(current.id, "verifying", actor.userId);
    }
    const stateAfterIntermediate = harness.getRun(current.id).state;
    if (nextState !== current.state && canTransitionForgeRun(stateAfterIntermediate, nextState)) {
      harness.transition(current.id, nextState, actor.userId);
    }

    const updated = harness.getRun(current.id);
    if (!updated.agentRunIds.includes(agentRunId)) {
      updated.agentRunIds.push(agentRunId);
    }

    const sandbox = payload.sandbox;
    if (sandbox && typeof sandbox === "object") {
      updated.events.push({
        id: randomUUID(),
        type: "FORGE_SANDBOX_PLANNED",
        runId: updated.id,
        timestamp: new Date().toISOString(),
        actor: actor.userId,
        detail: { taskId: task.id, agentRunId, sandboxDecision: (sandbox as { decision?: string }).decision }
      } as const);
    }

    const patch = payload.patch;
    if (patch && typeof patch === "object") {
      updated.events.push({
        id: randomUUID(),
        type: "FORGE_PATCH_PROPOSED",
        runId: updated.id,
        timestamp: new Date().toISOString(),
        actor: actor.userId,
        detail: { taskId: task.id, agentRunId, patchDecision: (patch as { decision?: string }).decision }
      } as const);
    }

    const tools = payload.tools;
    if (tools && typeof tools === "object") {
      updated.events.push({
        id: randomUUID(),
        type: "FORGE_TOOLS_PLANNED",
        runId: updated.id,
        timestamp: new Date().toISOString(),
        actor: actor.userId,
        detail: { taskId: task.id, agentRunId, toolsDecision: (tools as { decision?: string }).decision, action: (tools as { action?: string }).action }
      } as const);
    }

    const patchResult = payload.patchResult;
    if (patchResult && typeof patchResult === "object") {
      updated.events.push({
        id: randomUUID(),
        type: "FORGE_PATCH_SIMULATED",
        runId: updated.id,
        timestamp: new Date().toISOString(),
        actor: actor.userId,
        detail: { taskId: task.id, agentRunId, patchResultDecision: (patchResult as { decision?: string }).decision }
      } as const);
    }

    const verification = payload.verification;
    const verificationDetail: Record<string, unknown> = { taskId: task.id, agentRunId, policyDecision: policy?.decision };
    if (verification && typeof verification === "object") {
      const matrix = verification as { passed?: boolean; items?: unknown[] };
      verificationDetail.passed = matrix.passed;
      verificationDetail.itemCount = Array.isArray(matrix.items) ? matrix.items.length : 0;
      verificationDetail.failedCount = Array.isArray(matrix.items)
        ? matrix.items.filter((item) => (item as { status?: string }).status === "failed").length
        : 0;
      verificationDetail.requiredFailed = Array.isArray(matrix.items)
        ? matrix.items.filter((item) => (item as { required?: boolean; status?: string }).required && (item as { status?: string }).status === "failed").length
        : 0;
    }

    updated.events.push({
      id: randomUUID(),
      type: "FORGE_VERIFICATION_COMPLETED",
      runId: updated.id,
      timestamp: new Date().toISOString(),
      actor: actor.userId,
      detail: verificationDetail
    } as const);

    if (prPackage && prPackage.decision !== "deny") {
      updated.events.push({
        id: randomUUID(),
        type: "FORGE_PR_READY",
        runId: updated.id,
        timestamp: new Date().toISOString(),
        actor: actor.userId,
        detail: {
          taskId: task.id,
          agentRunId,
          prPackageDecision: prPackage.decision,
          headBranch: prPackage.headBranch,
          baseBranch: prPackage.baseBranch,
          changedFileCount: prPackage.changedFiles.length
        }
      } as const);
    }

    const persisted = await this.repository.update({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      run: updated
    });

    await this.auditService.append({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      actorUserId: actor.userId,
      action: "forge.task.complete",
      entityType: "ForgeRun",
      entityId: persisted.id,
      requestId,
      timestamp: new Date().toISOString(),
      afterJson: { taskId: task.id, agentRunId, policyDecision: policy?.decision }
    });

    return persisted;
  }

  async decideApproval(input: {
    actor: ForgeActor;
    runId: string;
    mode: ForgeApprovalMode;
    decision: "approved" | "rejected";
    requestId: string;
  }): Promise<ForgeRun> {
    const current = await this.repository.findById({ tenantId: input.actor.tenantId, runId: input.runId });
    const harness = this.load(current);

    if (input.decision === "approved") {
      harness.approve(input.runId, input.mode, input.actor.userId);
    } else {
      const run = harness.getRun(input.runId);
      const approval = run.approvals.find(
        (candidate) => candidate.mode === input.mode && candidate.status === "pending"
      );
      if (approval) {
        approval.status = "rejected";
        approval.actor = input.actor.userId;
        approval.at = new Date().toISOString();
      }
    }

    const updated = harness.getRun(input.runId);
    const persisted = await this.repository.update({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      userId: input.actor.userId,
      run: updated
    });

    await this.auditService.append({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      actorUserId: input.actor.userId,
      action: "forge.approval.decide",
      entityType: "ForgeRun",
      entityId: persisted.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: { mode: input.mode, decision: input.decision }
    });

    return persisted;
  }

  async missionControl(input: { tenantId: string }): Promise<ReturnType<ForgeRepository["missionControlSummary"]>> {
    return this.repository.missionControlSummary(input.tenantId);
  }

  private load(run: ForgeRun): ForgeHarness {
    const harness = new ForgeHarness();
    harness.loadRun(run);
    return harness;
  }
}
