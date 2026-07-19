import type { OrchestrationStatus } from "@semse/schemas";

/**
 * Prometeo orchestration finite-state machine.
 *
 * idle → interpreting → (ambiguity_resolving?) → agent_consultation →
 *        execution → completed
 * any active state → failed
 *
 * Transitions are pure and total: {@link nextOrchestrationStatus} throws on an
 * illegal transition so callers never silently corrupt the FSM.
 */

const TRANSITIONS: Record<OrchestrationStatus, OrchestrationStatus[]> = {
  idle: ["interpreting", "failed"],
  interpreting: ["ambiguity_resolving", "agent_consultation", "failed"],
  ambiguity_resolving: ["agent_consultation", "failed"],
  agent_consultation: ["execution", "failed"],
  execution: ["completed", "failed"],
  completed: [],
  failed: [],
};

export function canTransition(from: OrchestrationStatus, to: OrchestrationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextOrchestrationStatus(
  from: OrchestrationStatus,
  to: OrchestrationStatus,
): OrchestrationStatus {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal orchestration transition: ${from} -> ${to}`);
  }
  return to;
}

export function isTerminal(status: OrchestrationStatus): boolean {
  return status === "completed" || status === "failed";
}
