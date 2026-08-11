import { randomUUID } from "node:crypto";
import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { canTransitionForgeRun, categoriesForPaths, dependenciesSucceeded, ForgeHarness } from "@semse/forge";
import type {
  ForgeAgentRole,
  ForgeApprovalMode,
  ForgeDeploymentPlan,
  ForgeObservationPlan,
  ForgePolicyResult,
  ForgeSecurityReport,
  ForgePRPackage,
  ForgeRollbackPlan,
  ForgeRun,
  ForgeRunState,
  ForgeSpecReference,
  ForgeTaskPacket
} from "@semse/forge";
import type { AgentRunRecord } from "../../common/domain-store.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { ForgeLeaseService } from "../../infrastructure/forge/forge-lease.service.js";
import { ForgeAgentAdapterService } from "./forge-agent-adapter.service.js";
import { ForgeRepository } from "./forge.repository.js";

export type ForgeActor = { tenantId: string; orgId: string; userId: string; roles?: string[] };

function allModesApproved(
  approvals: ForgeRun["approvals"],
  modes: ForgeApprovalMode[]
): boolean {
  const unique = [...new Set(modes)];
  if (unique.length === 0) return true;
  return unique.every((mode) =>
    approvals.some((approval) => approval.mode === mode && approval.status === "approved")
  );
}

@Injectable()
export class ForgeService {
  constructor(
    private readonly repository: ForgeRepository,
    private readonly adapter: ForgeAgentAdapterService,
    private readonly auditService: AuditService,
    private readonly leaseService: ForgeLeaseService
  ) {}

  async list(tenantId: string): Promise<ForgeRun[]> {
    return this.repository.list(tenantId);
  }

  async findById(input: { tenantId: string; runId: string }): Promise<ForgeRun> {
    return this.repository.findById(input);
  }

  async listRunnableTasks(input: { tenantId: string; runId: string }): Promise<ForgeTaskPacket[]> {
    const current = await this.repository.findById(input);
    const harness = this.load(current);
    return harness.listRunnableTasks(input.runId);
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
    // Server-side re-derivation, same principle as authorizeTaskAction's policy
    // check below: a caller could otherwise call executeTask on a task whose
    // dependencies haven't succeeded yet. Deliberately dependenciesSucceeded(),
    // not listRunnableTasks() — the latter also excludes a task whose own
    // status isn't pending/ready, which is correct for the proactive
    // scheduler (dispatchNext shouldn't auto-redispatch an already-succeeded
    // task) but wrong here: Forge re-invokes the SAME task multiple times
    // with different actions (prPackage, then deployment.propose, then
    // rollback.propose, ...), so an explicit call naming a taskId must still
    // be allowed once that task has already succeeded once.
    // harness.assignTask() has its own (equally dependency-only) guard too —
    // defense in depth for any other caller of the pure package — but that
    // throws a generic Error; this check gives a real 409 instead.
    if (!dependenciesSucceeded(task, current.tasks)) {
      throw new ConflictException(
        `Task '${input.taskId}' is not runnable yet — one or more dependencies haven't succeeded.`
      );
    }
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
      // `agentRunIds` is intentionally not registered here; `applyTaskResult` adds it
      // when the worker reports completion, preserving idempotency of `completeTask`.
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
    const action = typeof payload.action === "string"
      ? payload.action
      : (input.task.allowedCommands[0] ?? "runtime.execute");
    const prPackage = payload.prPackage as ForgePRPackage | undefined;

    // Resource leases (SEMSE_FORGE_AGENT_HARNESS.spec.md §9) — a distinct gate
    // from the policy/approval evaluation below: even a task the policy would
    // allow must not run concurrently with another task touching the same
    // sensitive category (schema, migrations, auth, payments, ...). Acquired
    // here, released in the `finally` below regardless of how this method
    // exits — see ForgeLeaseService's header comment for why this is scoped
    // to one applyTaskResult() call rather than a task's full lifecycle.
    // Sorted so two concurrent requests touching the same set of categories
    // always attempt acquisition in the same order. Without this, task A
    // (files in [schema, migrations] order) and task B (the same files in
    // [migrations, schema] order) running in parallel could each grab a
    // different category and then both deny on the other's — neither making
    // progress — instead of one deterministically winning both.
    const leaseCategories = [...categoriesForPaths(prPackage?.changedFiles ?? [])].sort();
    const acquiredLeases: string[] = [];
    let leaseDenial:
      | { category: string; heldBy?: { runId: string; taskId: string }; reason?: string }
      | undefined;
    for (const category of leaseCategories) {
      const lease = await this.leaseService.acquire({
        category,
        tenantId: actor.tenantId,
        runId: current.id,
        taskId: task.id
      });
      if (lease.acquired) {
        acquiredLeases.push(category);
      } else {
        leaseDenial = { category, heldBy: lease.heldBy, reason: lease.reason };
        break;
      }
    }
    if (leaseDenial) {
      // Don't hold onto leases for an action that's already decided to be denied.
      for (const category of acquiredLeases.splice(0, acquiredLeases.length)) {
        await this.leaseService.release({ category, tenantId: actor.tenantId, runId: current.id, taskId: task.id });
      }

      // A lease denial is transient (concurrent contention, or Redis briefly
      // unreachable) — unlike a policy/prPackage/etc. deny below, which is
      // deterministic and belongs in "blocked" until a human intervenes.
      // Persisting a state transition here would permanently wedge the run:
      // every nextState branch further down derives from current.state, and
      // none of them can ever move a "blocked" run back to
      // "ready_for_review" without a manual transition. So this returns
      // early instead — no state change, no agentRunId registered, nothing
      // for authorizeTaskAction/approvals to react to — leaving the run
      // exactly as it was so the same result can be resubmitted once the
      // resource frees up. Only an audit trail entry marks that this
      // attempt happened.
      const blockedRun = harness.getRun(current.id);
      blockedRun.events.push({
        id: randomUUID(),
        type: "FORGE_RUN_BLOCKED",
        runId: blockedRun.id,
        timestamp: new Date().toISOString(),
        actor: actor.userId,
        detail: {
          taskId: task.id,
          agentRunId,
          reason:
            leaseDenial.reason === "lease_coordination_unavailable"
              ? "policy.resource_lock_unavailable"
              : "policy.resource_locked",
          category: leaseDenial.category,
          heldBy: leaseDenial.heldBy
        }
      } as const);
      // Without this, the task's last event is now FORGE_RUN_BLOCKED and
      // toDomain()'s deriveTaskStatus() would infer "failed" on the next
      // read — permanently, since nothing re-derives it again once status is
      // set. That's exactly backwards for a denial this comment already
      // documents as transient: explicitly keep the task "pending" so it
      // stays eligible for listRunnableTasks() once the resource frees up.
      // Guarded on the task not already being "succeeded": this same lease
      // check runs on every action a task is re-invoked with, and a lease
      // conflict on a LATER action (e.g. deployment.propose) must not erase
      // an EARLIER action's completion — that would incorrectly re-block
      // every sibling task depending on this one's success.
      const blockedTaskIndex = blockedRun.tasks.findIndex((candidate) => candidate.id === task.id);
      if (blockedTaskIndex !== -1 && blockedRun.tasks[blockedTaskIndex].status !== "succeeded") {
        blockedRun.tasks[blockedTaskIndex] = { ...blockedRun.tasks[blockedTaskIndex], status: "pending" };
      }
      const blockedPersisted = await this.repository.update({
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        userId: actor.userId,
        run: blockedRun
      });
      await this.auditService.append({
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        actorUserId: actor.userId,
        action: "forge.task.complete",
        entityType: "ForgeRun",
        entityId: blockedPersisted.id,
        requestId,
        timestamp: new Date().toISOString(),
        afterJson: { taskId: task.id, agentRunId, leaseDenial }
      });

      // The audit trail is written above regardless, but the HTTP response
      // must NOT look like success: a 200 here would be indistinguishable
      // from the result actually being applied, so the caller would never
      // know to resubmit the same agentRunId once the resource frees up and
      // the completed work would be silently lost. 409 for real contention
      // (another run holds it — retrying immediately is expected to keep
      // failing until that run finishes); 503 when the coordination
      // mechanism itself is unavailable (Redis down — this affects every
      // completion touching a sensitive path, not just genuinely contended
      // ones, and is a dependency outage rather than a conflict).
      if (leaseDenial.reason === "lease_coordination_unavailable") {
        throw new ServiceUnavailableException(
          `Resource lease coordination unavailable for category '${leaseDenial.category}'; retry once Redis is reachable.`
        );
      }
      throw new ConflictException(
        `Resource '${leaseDenial.category}' is locked by another run/task; retry once it releases.`
      );
    }

    try {
    // The policy decision must come from the server's own evaluation, never
    // from the caller's payload — a caller could otherwise submit
    // `{ result: { payload: { policy: { decision: "allow" } } } }` and skip
    // whatever the real policy would have denied, since nothing re-ran the
    // check before. authorizeTaskAction() already calls evaluateForgePolicy()
    // internally; its return value was computed and thrown away previously.
    // changedFiles now comes from the submitted PR package (previously never
    // passed, so manifest.fileScopes/task file scoping was dead code — see
    // docs/AUDIT_REMEDIATION_PLAN.md 0.18). Note this doesn't (and can't,
    // without a real diff-of-record) verify changedFiles itself is honest —
    // only that the scope/risk/action policy is re-derived server-side
    // instead of trusted from the caller.
    const policy: ForgePolicyResult = harness.authorizeTaskAction({
      runId: current.id,
      taskId: task.id,
      role: task.requestedRole,
      action,
      changedFiles: prPackage?.changedFiles,
      requestedBy: actor.userId
    });

    const deployment = payload.deployment as ForgeDeploymentPlan | undefined;
    const rollback = payload.rollback as ForgeRollbackPlan | undefined;
    const observation = payload.observation as ForgeObservationPlan | undefined;
    const securityReport = payload.securityReport as ForgeSecurityReport | undefined;

    // Ensure any extra approvals required by the PR package, deployment plan, rollback plan, observation plan or security review are tracked.
    const extraApprovalModes = new Set<ForgeApprovalMode>();
    for (const mode of prPackage?.requiredApprovals ?? []) extraApprovalModes.add(mode);
    for (const mode of deployment?.requiredApprovals ?? []) extraApprovalModes.add(mode);
    for (const mode of rollback?.requiredApprovals ?? []) extraApprovalModes.add(mode);
    for (const mode of observation?.requiredApprovals ?? []) extraApprovalModes.add(mode);
    for (const mode of securityReport?.requiredApprovals ?? []) extraApprovalModes.add(mode);
    for (const mode of extraApprovalModes) {
      harness.ensurePendingApproval(current.id, mode, actor.userId);
    }
    const runAfterApprovals = harness.getRun(current.id);

    const anyDeny =
      policy?.decision === "deny" ||
      prPackage?.decision === "deny" ||
      deployment?.decision === "deny" ||
      rollback?.decision === "deny" ||
      securityReport?.decision === "deny";

    let nextState = current.state;
    if (anyDeny) {
      nextState = "blocked";
    } else if (prPackage) {
      nextState = current.state === "building" || current.state === "verifying" ? "ready_for_review" : current.state;
    } else if (deployment) {
      nextState =
        current.state === "merged" &&
        (deployment.decision === "allow" || allModesApproved(runAfterApprovals.approvals, deployment.requiredApprovals))
          ? "deployed"
          : current.state;
    } else if (rollback) {
      nextState =
        (current.state === "deployed" || current.state === "observing") &&
        (rollback.decision === "allow" || allModesApproved(runAfterApprovals.approvals, rollback.requiredApprovals))
          ? "rolled_back"
          : current.state;
    } else if (observation) {
      if (current.state === "deployed" || current.state === "observing") {
        nextState = "observing";
        if (observation.decision === "deny") {
          nextState = "rolled_back";
        } else if (
          current.state === "observing" &&
          allModesApproved(runAfterApprovals.approvals, observation.requiredApprovals)
        ) {
          nextState = "closed";
        }
      }
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

    // If the run is observing after an observation proposal and approvals are already
    // satisfied, move it to closed in the same handling cycle.
    if (observation && observation.decision !== "deny") {
      const runAfterObservation = harness.getRun(current.id);
      if (
        runAfterObservation.state === "observing" &&
        allModesApproved(runAfterObservation.approvals, observation.requiredApprovals) &&
        canTransitionForgeRun("observing", "closed")
      ) {
        harness.transition(current.id, "closed", actor.userId);
      }
    }

    const updated = harness.getRun(current.id);
    if (!updated.agentRunIds.includes(agentRunId)) {
      updated.agentRunIds.push(agentRunId);
    }

    // Every reachable outcome here sets an explicit task.status — never leaves
    // it unset on a deny/require_approval path. Two reasons: (1) anyDeny is
    // the SAME condition nextState above already used, not just policy's own
    // decision — a policy=allow result can still be blocked by e.g.
    // securityReport=deny, and that must not read as the task having
    // succeeded; (2) toDomain()'s deriveTaskStatus() only exists to
    // best-effort-infer status for rows persisted before this field existed —
    // leaving it unset here would feed it a live task's event tail (which
    // includes later unconditional events like FORGE_VERIFICATION_COMPLETED
    // with this same agentRunId already registered) and it would misread a
    // denied/pending task as "succeeded" on the next read. "blocked_on_approval"
    // is coarser than Fase 3d's eventual per-mode tracking, but is still
    // correctly excluded from listRunnableTasks() today.
    const taskStatus = anyDeny ? "failed" : policy?.decision === "require_approval" ? "blocked_on_approval" : "succeeded";
    const taskIndex = updated.tasks.findIndex((candidate) => candidate.id === task.id);
    if (taskIndex !== -1) {
      updated.tasks[taskIndex] = { ...updated.tasks[taskIndex], status: taskStatus };
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

    if (deployment) {
      updated.events.push({
        id: randomUUID(),
        type: "FORGE_DEPLOYMENT_PROPOSED",
        runId: updated.id,
        timestamp: new Date().toISOString(),
        actor: actor.userId,
        detail: {
          taskId: task.id,
          agentRunId,
          deploymentDecision: deployment.decision,
          environment: deployment.environment,
          targetBranch: deployment.targetBranch,
          stepCount: deployment.steps.length,
          requiredApprovals: deployment.requiredApprovals
        }
      } as const);
    }

    if (rollback) {
      updated.events.push({
        id: randomUUID(),
        type: "FORGE_ROLLBACK_PROPOSED",
        runId: updated.id,
        timestamp: new Date().toISOString(),
        actor: actor.userId,
        detail: {
          taskId: task.id,
          agentRunId,
          rollbackDecision: rollback.decision,
          environment: rollback.environment,
          targetBranch: rollback.targetBranch,
          stepCount: rollback.steps.length,
          requiredApprovals: rollback.requiredApprovals
        }
      } as const);
    }

    if (observation) {
      updated.events.push({
        id: randomUUID(),
        type: "FORGE_OBSERVATION_PROPOSED",
        runId: updated.id,
        timestamp: new Date().toISOString(),
        actor: actor.userId,
        detail: {
          taskId: task.id,
          agentRunId,
          observationDecision: observation.decision,
          environment: observation.environment,
          targetBranch: observation.targetBranch,
          stepCount: observation.steps.length,
          requiredApprovals: observation.requiredApprovals
        }
      } as const);
    }

    if (securityReport) {
      updated.events.push({
        id: randomUUID(),
        type: "FORGE_SECURITY_REVIEW_COMPLETED",
        runId: updated.id,
        timestamp: new Date().toISOString(),
        actor: actor.userId,
        detail: {
          taskId: task.id,
          agentRunId,
          securityDecision: securityReport.decision,
          findingCount: securityReport.findings.length,
          criticalCount: securityReport.findings.filter((finding) => finding.severity === "critical").length,
          requiredApprovals: securityReport.requiredApprovals
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
    } finally {
      for (const category of acquiredLeases) {
        await this.leaseService.release({ category, tenantId: actor.tenantId, runId: current.id, taskId: task.id });
      }
    }
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
      harness.reject(input.runId, input.mode, input.actor.userId);
    }

    const updated = harness.getRun(input.runId);

    if (input.decision === "approved" && updated.state === "merged") {
      const deploymentEvent = [...updated.events]
        .reverse()
        .find((event) => event.type === "FORGE_DEPLOYMENT_PROPOSED");
      const requiredApprovals = (deploymentEvent?.detail?.requiredApprovals as ForgeApprovalMode[]) ?? [];
      if (requiredApprovals.length > 0 && allModesApproved(updated.approvals, requiredApprovals)) {
        harness.transition(input.runId, "deployed", input.actor.userId);
      }
    }

    if (input.decision === "approved" && (updated.state === "deployed" || updated.state === "observing")) {
      const rollbackEvent = [...updated.events]
        .reverse()
        .find((event) => event.type === "FORGE_ROLLBACK_PROPOSED");
      const requiredApprovals = (rollbackEvent?.detail?.requiredApprovals as ForgeApprovalMode[]) ?? [];
      if (requiredApprovals.length > 0 && allModesApproved(updated.approvals, requiredApprovals)) {
        harness.transition(input.runId, "rolled_back", input.actor.userId);
      }
    }

    if (input.decision === "approved" && updated.state === "observing") {
      const observationEvent = [...updated.events]
        .reverse()
        .find((event) => event.type === "FORGE_OBSERVATION_PROPOSED");
      const requiredApprovals = (observationEvent?.detail?.requiredApprovals as ForgeApprovalMode[]) ?? [];
      const observationDecision = observationEvent?.detail?.observationDecision as string | undefined;
      if (
        observationDecision !== "deny" &&
        requiredApprovals.length > 0 &&
        allModesApproved(updated.approvals, requiredApprovals)
      ) {
        harness.transition(input.runId, "closed", input.actor.userId);
      }
    }

    const updatedAfterTransition = harness.getRun(input.runId);
    const persisted = await this.repository.update({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      userId: input.actor.userId,
      run: updatedAfterTransition
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
