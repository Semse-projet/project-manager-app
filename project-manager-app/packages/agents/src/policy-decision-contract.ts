/**
 * Compile-time-only proof that this repo's real allow/deny/require_approval
 * gating engines structurally satisfy the shared `PolicyDecisionBase`
 * (`@semse/schemas`) on their outer `decision` field, without merging or
 * even importing each other's richer approval-mode payloads.
 *
 * This file has no runtime effect (it's erased by `tsc`) and exists purely
 * so a future change that breaks the shared `decision` field on either
 * engine's result type fails the build here, in one place, instead of
 * silently drifting. See `.claude/skills/semse-agents-governance/SKILL.md`
 * for why `packages/agents/src/action-policy.ts`'s `getActionPolicy` is
 * deliberately NOT included here — it has no `decision` field to check.
 */
import type { PolicyDecisionBase } from "@semse/schemas";
import type { ForgePolicyResult } from "@semse/forge";
import type { AgentPolicyResult } from "./governance.js";

function assertSatisfiesPolicyDecisionBase<T extends PolicyDecisionBase>(): void {
  // Type-only assertion — never called at runtime.
}

assertSatisfiesPolicyDecisionBase<AgentPolicyResult>();
assertSatisfiesPolicyDecisionBase<ForgePolicyResult>();
