/**
 * Shared shape for the OUTER decision of every allow/deny/require_approval
 * policy engine in this repo (see `.claude/skills/semse-agents-governance/SKILL.md`
 * for the full map). This unifies ONLY the `decision` field — every engine's
 * richer approval-mode payload (free-text rule IDs in `@semse/agents`'
 * `evaluateAgentPolicy`, `ForgeApprovalMode[]` in `@semse/forge`'s
 * `evaluateForgePolicy`, the collapsed single-state bucket in
 * `evaluatePrometeoToolPolicy`) stays engine-specific on purpose. Those
 * payloads scope on genuinely different axes (agent-capability+risk vs.
 * file/branch/spec-scope vs. RBAC-permission+static-tier) and unifying them
 * requires the vocabulary ADR `docs/specs/prometeo/tool-registry-governance.spec.md:158-170`
 * already calls for — not a code merge.
 *
 * `packages/agents/src/action-policy.ts`'s `getActionPolicy`/`resolveApprovalMode`
 * deliberately does NOT implement this interface: it never denies anything
 * and returns `{ approvalMode, riskLevel }` with no `decision` field at all —
 * it labels a proposed action for review, it doesn't gate one. Forcing a
 * synthetic `decision` onto it would misrepresent behavior it doesn't have.
 */
export const policyDecisionOutcomes = ["allow", "deny", "require_approval"] as const;
export type PolicyDecisionOutcome = (typeof policyDecisionOutcomes)[number];

export interface PolicyDecisionBase {
  decision: PolicyDecisionOutcome;
}
