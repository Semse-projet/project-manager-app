import { randomUUID } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { ForgeHarness } from "@semse/forge";
import type {
  ForgeAgentRole,
  ForgeApprovalMode,
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
    requestId: string;
  }): Promise<{ forgeRun: ForgeRun; agentRun: AgentRunRecord; result: Record<string, unknown> }> {
    const current = await this.repository.findById({ tenantId: input.actor.tenantId, runId: input.runId });
    const task = current.tasks.find((candidate) => candidate.id === input.taskId);
    if (!task) {
      throw new NotFoundException(`Forge task '${input.taskId}' not found`);
    }

    const harness = this.load(current);
    harness.assignTask(input.runId, input.taskId, task.requestedRole);
    const { agentRun, result } = await this.adapter.execute({
      actor: input.actor,
      forgeRun: current,
      task,
      action: input.action
    });

    const policy = (result as unknown as { payload?: Record<string, unknown> }).payload?.policy as
      | { decision: string; riskLevel: string; requiredApprovals: string[] }
      | undefined;

    harness.authorizeTaskAction({
      runId: input.runId,
      taskId: input.taskId,
      role: task.requestedRole,
      action: input.action ?? (task.allowedCommands[0] ?? "runtime.execute")
    });

    let stateUpdate = current.state;
    if (policy?.decision === "deny") {
      stateUpdate = "blocked";
    } else if (policy?.decision === "require_approval") {
      stateUpdate = stateUpdate === "building" ? stateUpdate : "ready_for_review";
    }

    if (stateUpdate !== current.state) {
      harness.transition(input.runId, stateUpdate, input.actor.userId);
    }

    const updated = harness.getRun(input.runId);
    updated.events.push({
      id: randomUUID(),
      type: "FORGE_VERIFICATION_COMPLETED",
      runId: updated.id,
      timestamp: new Date().toISOString(),
      actor: input.actor.userId,
      detail: { taskId: input.taskId, agentRunId: agentRun.id, policyDecision: policy?.decision }
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
      action: "forge.task.execute",
      entityType: "ForgeRun",
      entityId: persisted.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: { taskId: input.taskId, agentRunId: agentRun.id, policyDecision: policy?.decision }
    });

    return { forgeRun: persisted, agentRun, result: result as unknown as Record<string, unknown> };
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
