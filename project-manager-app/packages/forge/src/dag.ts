import type { ForgeRun, ForgeTaskPacket, ForgeTaskStatus } from "./types.js";

export type DagValidationResult = { valid: true } | { valid: false; errors: string[] };

/**
 * Checks that every `dependencies` entry references an existing task id in
 * the same run, and that the dependency graph has no cycles. Both checks
 * run over the FULL candidate task list (existing tasks + the one being
 * added), since a cycle or dangling reference can only be detected with the
 * complete picture.
 */
export function validateTaskDependencies(tasks: ForgeTaskPacket[]): DagValidationResult {
  const errors: string[] = [];
  const byId = new Map<string, ForgeTaskPacket>();
  for (const task of tasks) {
    byId.set(task.id, task);
  }

  for (const task of tasks) {
    for (const depId of task.dependencies) {
      if (!byId.has(depId)) {
        errors.push(`Task '${task.id}' depends on unknown task '${depId}'`);
      }
    }
  }

  if (errors.length === 0) {
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (taskId: string, path: string[]): void => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) {
        errors.push(`Dependency cycle detected: ${[...path, taskId].join(" -> ")}`);
        return;
      }
      const task = byId.get(taskId);
      if (!task) return; // already reported as a missing reference above

      visiting.add(taskId);
      for (const depId of task.dependencies) {
        visit(depId, [...path, taskId]);
      }
      visiting.delete(taskId);
      visited.add(taskId);
    };

    for (const task of tasks) {
      visit(task.id, []);
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Best-effort status inference for tasks persisted before per-task status
 * existed (task.status is undefined). Not exact — the event log wasn't
 * designed to answer "what state was this task in," so this only needs to
 * be a reasonable default, not a perfect reconstruction. New writes always
 * set task.status explicitly going forward (see forge.service.ts's
 * applyTaskResult), so this function's inference path decays in relevance
 * over time as old rows get touched again.
 */
export function deriveTaskStatus(task: ForgeTaskPacket, run: ForgeRun): ForgeTaskStatus {
  if (task.status) return task.status;

  const taskEvents = run.events.filter((event) => event.detail?.taskId === task.id);
  const lastEvent = taskEvents.at(-1);
  if (!lastEvent) return "pending";
  if (lastEvent.type === "FORGE_RUN_BLOCKED") return "failed";

  const agentRunId = lastEvent.detail?.agentRunId;
  if (typeof agentRunId === "string" && run.agentRunIds.includes(agentRunId)) {
    return "succeeded";
  }

  return "running";
}

/**
 * A task is runnable iff its own status allows it to start and every one of
 * its declared dependencies has already succeeded. Tasks without an
 * explicit status (not yet normalized via deriveTaskStatus) default to
 * "pending" here so this stays safe to call directly on hand-built task
 * lists (e.g. in tests) without going through a ForgeRun first.
 */
export function listRunnableTasks(tasks: ForgeTaskPacket[]): ForgeTaskPacket[] {
  const statusById = new Map<string, ForgeTaskStatus>();
  for (const task of tasks) {
    statusById.set(task.id, task.status ?? "pending");
  }

  return tasks.filter((task) => {
    const status = statusById.get(task.id) ?? "pending";
    if (status !== "pending" && status !== "ready") return false;
    return task.dependencies.every((depId) => statusById.get(depId) === "succeeded");
  });
}
