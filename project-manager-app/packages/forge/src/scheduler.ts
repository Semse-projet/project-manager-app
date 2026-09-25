import { listRunnableTasks } from "./dag.js";
import type { ForgeTaskPacket } from "./types.js";

/**
 * Narrows the runnable set (dag.ts's listRunnableTasks) down to what should
 * actually be dispatched right now, given a per-run concurrency cap. Lower
 * `priority` dispatches first (same convention as AgentQueueService's
 * AGENT_PRIORITY); tasks with no priority sort last; ties break by original
 * array order so dispatch order is deterministic and stable across calls
 * for an otherwise-unchanged task list.
 *
 * Deliberately per-run only — global/worker concurrency stays a flat
 * BullMQ Worker option (apps/worker/src/main.mjs) for now. Splitting a
 * dedicated Forge worker is premature while every provider is still
 * dry-run-only: the real contention today is over the *decision* to
 * dispatch, not over compute.
 */
export function selectDispatchable(
  tasks: ForgeTaskPacket[],
  input: { maxConcurrentPerRun: number; currentlyRunning: number }
): ForgeTaskPacket[] {
  const capacity = input.maxConcurrentPerRun - input.currentlyRunning;
  if (capacity <= 0) return [];

  const runnable = listRunnableTasks(tasks);
  const ranked = runnable.map((task, index) => ({ task, index }));
  ranked.sort((a, b) => {
    const priorityA = a.task.priority ?? Number.MAX_SAFE_INTEGER;
    const priorityB = b.task.priority ?? Number.MAX_SAFE_INTEGER;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.index - b.index;
  });

  return ranked.slice(0, capacity).map(({ task }) => task);
}
