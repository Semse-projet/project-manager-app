/**
 * Delegate — isolated subagent context.
 * Inspired by Hermes's tools/delegate_tool.py.
 *
 * Key rules (mirroring Hermes invariants):
 *   - Subagents get a FRESH conversation — no parent history
 *   - Blocked roles can never be delegated to (no recursive orchestration loops)
 *   - The parent only sees the DelegateResult, never the child's intermediate steps
 *   - toolsAllowed is always intersected with the child's own registration
 */
import { AgentRegistry } from "./registry.js";
import type { RuntimeAgentInput, RuntimeAgentResult, RuntimeAgentRole } from "./governance.js";

/** Roles that can never receive a delegation — prevents loops and side effects. */
export const DELEGATE_BLOCKED_ROLES = new Set<string>([
  "orchestrator",  // no recursive orchestration
  "ecv",           // ECV must run at the top level, not as a child
]);

export interface DelegateOptions {
  /** Goal description for the subagent — replaces parent history */
  goal: string;
  /** Additional context the child needs (stripped of any parent PII) */
  context?: Record<string, unknown>;
  /** Override which tools the child may use (must be subset of its own allowed list) */
  restrictToolsTo?: string[];
}

export interface DelegateResult {
  role: RuntimeAgentRole;
  goal: string;
  result: RuntimeAgentResult;
  durationMs: number;
  toolsUsed: string[];
  blockedByPolicy: boolean;
}

export function delegateTo(
  role: RuntimeAgentRole,
  options: DelegateOptions,
): DelegateResult {
  const start = Date.now();

  if (DELEGATE_BLOCKED_ROLES.has(role)) {
    return {
      role,
      goal: options.goal,
      result: {
        actionType: "alert",
        summary: `Delegation to "${role}" is blocked by policy`,
        confidence: 1,
        requiresHumanReview: true,
        payload: { blocked: true, reason: "DELEGATE_BLOCKED_ROLES" },
      },
      durationMs: 0,
      toolsUsed: [],
      blockedByPolicy: true,
    };
  }

  const registration = AgentRegistry.resolve(role);

  // Compute effective tool list: child's own allowlist ∩ requested restriction
  const effectiveTools = options.restrictToolsTo
    ? registration.toolsAllowed.filter((t) => options.restrictToolsTo!.includes(t))
    : registration.toolsAllowed;

  // Build an isolated input — no parent session, no parent history
  const isolatedInput: RuntimeAgentInput = {
    eventType: "delegate.task",
    eventPayload: {
      goal: options.goal,
      context: options.context ?? {},
      effectiveTools,
    },
    operatorContext: undefined,   // never inherit parent operator context
  };

  const result = registration.handler(isolatedInput);

  return {
    role,
    goal: options.goal,
    result,
    durationMs: Date.now() - start,
    toolsUsed: effectiveTools,
    blockedByPolicy: false,
  };
}

/** Parallel delegation — runs multiple subagents and collects all results. */
export function delegateAll(
  tasks: Array<{ role: RuntimeAgentRole; options: DelegateOptions }>,
): DelegateResult[] {
  return tasks.map(({ role, options }) => delegateTo(role, options));
}
