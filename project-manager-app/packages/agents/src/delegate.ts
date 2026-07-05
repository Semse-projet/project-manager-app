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
import { agentToolRegistry, type AgentToolName, type RuntimeAgentInput, type RuntimeAgentResult, type RuntimeAgentRole } from "./governance.js";
import {
  DELEGATE_BUDGET_RATIO,
  MAX_CONCURRENT_DELEGATES,
  type DelegateProfile,
  type VerificationBudget
} from "./verification.js";

/** Roles that can never receive a delegation — prevents loops and side effects. */
export const DELEGATE_BLOCKED_ROLES = new Set<string>([
  "orchestrator",  // no recursive orchestration
  "ecv",           // ECV must run at the top level, not as a child
]);

/** Tool categories a read-only "explore" delegate may use (SPEC-AGT-001 §4). */
const EXPLORE_ALLOWED_CATEGORIES = new Set(["context", "memory", "verification"]);

function isExploreSafeTool(toolName: string): boolean {
  const definition = agentToolRegistry[toolName as AgentToolName];
  return definition ? EXPLORE_ALLOWED_CATEGORIES.has(definition.category) : false;
}

/** Sub-budget para delegados `general`: ≤ DELEGATE_BUDGET_RATIO del budget del padre. */
export function deriveDelegateBudget(parent: VerificationBudget): VerificationBudget {
  return {
    ...parent,
    maxIterations: Math.max(1, Math.floor(parent.maxIterations * DELEGATE_BUDGET_RATIO)),
    ...(parent.maxTokens ? { maxTokens: Math.floor(parent.maxTokens * DELEGATE_BUDGET_RATIO) } : {}),
    ...(parent.timeoutMs ? { timeoutMs: Math.floor(parent.timeoutMs * DELEGATE_BUDGET_RATIO) } : {})
  };
}

export interface DelegateOptions {
  /** Goal description for the subagent — replaces parent history */
  goal: string;
  /** Additional context the child needs (stripped of any parent PII) */
  context?: Record<string, unknown>;
  /** Override which tools the child may use (must be subset of its own allowed list) */
  restrictToolsTo?: string[];
  /**
   * SPEC-AGT-001 §4 — perfil de delegación.
   * "explore": solo tools de lectura + verificación; pedir una tool de
   * escritura produce deny. "general" (default): hereda el manifest del rol
   * con sub-budget propio.
   */
  profile?: DelegateProfile;
  /** Budget del padre — el hijo `general` recibe ≤50% (deriveDelegateBudget). */
  parentBudget?: VerificationBudget;
}

export interface DelegateResult {
  role: RuntimeAgentRole;
  goal: string;
  result: RuntimeAgentResult;
  durationMs: number;
  toolsUsed: string[];
  blockedByPolicy: boolean;
  /** Perfil aplicado a la delegación (SPEC-AGT-001 §4). */
  profile: DelegateProfile;
  /** Budget derivado para el hijo (solo perfil general con parentBudget). */
  childBudget?: VerificationBudget;
}

function blockedResult(role: RuntimeAgentRole, options: DelegateOptions, reason: string, detail: Record<string, unknown>): DelegateResult {
  return {
    role,
    goal: options.goal,
    result: {
      actionType: "alert",
      summary: `Delegation to "${role}" is blocked by policy`,
      confidence: 1,
      requiresHumanReview: true,
      payload: { blocked: true, reason, ...detail },
    },
    durationMs: 0,
    toolsUsed: [],
    blockedByPolicy: true,
    profile: options.profile ?? "general",
  };
}

export function delegateTo(
  role: RuntimeAgentRole,
  options: DelegateOptions,
): DelegateResult {
  const start = Date.now();
  const profile: DelegateProfile = options.profile ?? "general";

  if (DELEGATE_BLOCKED_ROLES.has(role)) {
    return blockedResult(role, options, "DELEGATE_BLOCKED_ROLES", {});
  }

  const registration = AgentRegistry.resolve(role);

  // Un delegado "explore" que pide explícitamente una tool fuera de
  // lectura/verificación recibe deny (criterio de aceptación 4 del spec).
  if (profile === "explore" && options.restrictToolsTo) {
    const writeTools = options.restrictToolsTo.filter((tool) => !isExploreSafeTool(tool));
    if (writeTools.length > 0) {
      return blockedResult(role, options, "EXPLORE_PROFILE_WRITE_TOOL", { deniedTools: writeTools });
    }
  }

  // Compute effective tool list: child's own allowlist ∩ requested restriction,
  // further intersected with the explore envelope when that profile applies.
  let effectiveTools = options.restrictToolsTo
    ? registration.toolsAllowed.filter((t) => options.restrictToolsTo!.includes(t))
    : registration.toolsAllowed;

  if (profile === "explore") {
    effectiveTools = effectiveTools.filter((tool) => isExploreSafeTool(tool));
  }

  const childBudget = profile === "general" && options.parentBudget
    ? deriveDelegateBudget(options.parentBudget)
    : undefined;

  // Build an isolated input — no parent session, no parent history
  const isolatedInput: RuntimeAgentInput = {
    eventType: "delegate.task",
    eventPayload: {
      goal: options.goal,
      context: options.context ?? {},
      effectiveTools,
      profile,
      ...(childBudget ? { budget: childBudget } : {}),
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
    profile,
    ...(childBudget ? { childBudget } : {}),
  };
}

/**
 * Parallel delegation — runs multiple subagents and collects all results.
 * SPEC-AGT-001 §4: máximo MAX_CONCURRENT_DELEGATES activos por run; el resto
 * se encola y se procesa en tandas (rate limits de proveedores + costo).
 */
export function delegateAll(
  tasks: Array<{ role: RuntimeAgentRole; options: DelegateOptions }>,
  onBatch?: (batchSize: number) => void,
): DelegateResult[] {
  const results: DelegateResult[] = [];
  for (let offset = 0; offset < tasks.length; offset += MAX_CONCURRENT_DELEGATES) {
    const batch = tasks.slice(offset, offset + MAX_CONCURRENT_DELEGATES);
    onBatch?.(batch.length);
    results.push(...batch.map(({ role, options }) => delegateTo(role, options)));
  }
  return results;
}
