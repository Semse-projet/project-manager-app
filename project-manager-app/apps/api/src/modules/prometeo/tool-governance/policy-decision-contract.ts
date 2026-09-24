/**
 * Compile-time-only proof that `evaluatePrometeoToolPolicy`'s result
 * structurally satisfies the shared `PolicyDecisionBase` (`@semse/schemas`)
 * on its outer `decision` field. See
 * `.claude/skills/semse-agents-governance/SKILL.md` for the full 4-engine
 * policy map and why only the `decision` field is unified across engines,
 * never the richer approval-mode payloads.
 *
 * No runtime effect — erased by `tsc`. Exists so a future change that
 * drops or renames `decision` on `PrometeoToolPolicyResult` fails the build
 * here instead of silently drifting from the shared contract.
 */
import type { PolicyDecisionBase } from "@semse/schemas";
import type { PrometeoToolPolicyResult } from "./tool-governance.policy.js";

function assertSatisfiesPolicyDecisionBase<_T extends PolicyDecisionBase>(): void {
  // Type-only assertion — never called at runtime.
}

assertSatisfiesPolicyDecisionBase<PrometeoToolPolicyResult>();
