import { evaluateForgePolicy } from "./policy.js";
import { getForgeAgentManifest } from "./registry.js";
import { assertForgeRunTransition } from "./state-machine.js";
import type {
  ForgeAgentRole,
  ForgeEvent,
  ForgePolicyResult,
  ForgeRun,
  ForgeRunState,
  ForgeSpecReference,
  ForgeTaskPacket
} from "./types.js";

function uuid(): string {
  return (globalThis as unknown as { crypto: { randomUUID(): string } }).crypto.randomUUID();
}

export class ForgeHarness {
  private readonly runs = new Map<string, ForgeRun>();

  createRun(input: {
    title: string;
    spec: ForgeSpecReference;
    tasks?: ForgeTaskPacket[];
    actor?: string;
  }): ForgeRun {
    const now = new Date().toISOString();
    const id = uuid();
    const event: ForgeEvent = {
      id: uuid(),
      type: "FORGE_RUN_CREATED",
      runId: id,
      timestamp: now,
      actor: input.actor ?? "prometeo",
      detail: { specId: input.spec.id }
    };

    const run: ForgeRun = {
      id,
      title: input.title,
      state: "idea",
      spec: input.spec,
      tasks: input.tasks ?? [],
      assignedAgents: {},
      approvals: [],
      events: [event],
      createdAt: now,
      updatedAt: now
    };

    this.runs.set(id, run);
    return structuredClone(run);
  }

  getRun(runId: string): ForgeRun {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Forge run not found: ${runId}`);
    return structuredClone(run);
  }

  loadRun(run: ForgeRun): void {
    this.runs.set(run.id, structuredClone(run));
  }

  transition(runId: string, next: ForgeRunState, actor = "forge-supervisor"): ForgeRun {
    const run = this.requireRun(runId);
    assertForgeRunTransition(run.state, next);
    run.state = next;
    run.updatedAt = new Date().toISOString();

    if (next === "blocked") {
      this.recordEvent(run, "FORGE_RUN_BLOCKED", actor, {});
    } else if (next === "rolled_back") {
      this.recordEvent(run, "FORGE_RUN_ROLLED_BACK", actor, {});
    }

    return structuredClone(run);
  }

  addTask(runId: string, task: ForgeTaskPacket): ForgeRun {
    const run = this.requireRun(runId);
    if (run.tasks.some((candidate) => candidate.id === task.id)) {
      throw new Error(`Duplicate Forge task id: ${task.id}`);
    }
    run.tasks.push(structuredClone(task));
    run.updatedAt = new Date().toISOString();
    return structuredClone(run);
  }

  assignTask(runId: string, taskId: string, role: ForgeAgentRole): ForgeRun {
    const run = this.requireRun(runId);
    const task = run.tasks.find((candidate) => candidate.id === taskId);
    if (!task) throw new Error(`Forge task not found: ${taskId}`);
    if (task.requestedRole !== role) {
      throw new Error(`Task ${taskId} requires ${task.requestedRole}, not ${role}`);
    }

    const assignments = run.assignedAgents[role] ?? [];
    if (!assignments.includes(taskId)) assignments.push(taskId);
    run.assignedAgents[role] = assignments;
    run.updatedAt = new Date().toISOString();

    this.recordEvent(run, "FORGE_TASK_ASSIGNED", role, { taskId });
    return structuredClone(run);
  }

  authorizeTaskAction(input: {
    runId: string;
    taskId: string;
    role: ForgeAgentRole;
    action: string;
    changedFiles?: string[];
  }): ForgePolicyResult {
    const run = this.requireRun(input.runId);
    const task = run.tasks.find((candidate) => candidate.id === input.taskId);
    if (!task) throw new Error(`Forge task not found: ${input.taskId}`);

    const manifest = getForgeAgentManifest(input.role);
    const policy = evaluateForgePolicy({
      manifest,
      task,
      action: input.action,
      changedFiles: input.changedFiles
    });

    if (policy.decision === "require_approval") {
      for (const mode of policy.requiredApprovals) {
        if (!run.approvals.some((approval) => approval.mode === mode && approval.status === "pending")) {
          run.approvals.push({ mode, status: "pending" });
        }
      }
      this.recordEvent(run, "FORGE_HUMAN_REVIEW_REQUESTED", input.role, {
        taskId: input.taskId,
        approvals: policy.requiredApprovals
      });
    }

    if (policy.decision === "deny") {
      this.recordEvent(run, "FORGE_RUN_BLOCKED", input.role, {
        taskId: input.taskId,
        policies: policy.violatedPolicies
      });
    }

    run.updatedAt = new Date().toISOString();
    return policy;
  }

  approve(runId: string, mode: ForgeRun["approvals"][number]["mode"], actor: string): ForgeRun {
    const run = this.requireRun(runId);
    const approval = run.approvals.find(
      (candidate) => candidate.mode === mode && candidate.status === "pending"
    );
    if (!approval) throw new Error(`Pending approval not found: ${mode}`);
    approval.status = "approved";
    approval.actor = actor;
    approval.at = new Date().toISOString();
    run.updatedAt = approval.at;
    return structuredClone(run);
  }

  private requireRun(runId: string): ForgeRun {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Forge run not found: ${runId}`);
    return run;
  }

  private recordEvent(
    run: ForgeRun,
    type: ForgeEvent["type"],
    actor: string,
    detail: Record<string, unknown>
  ): void {
    run.events.push({
      id: uuid(),
      type,
      runId: run.id,
      timestamp: new Date().toISOString(),
      actor,
      detail
    });
  }
}
