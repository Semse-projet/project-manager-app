# ADR-035 — Agent Approval Governance Ownership (AG-01)

- **Date:** 2026-09-18
- **Status:** Accepted
- **Owners:** Agents Governance Reconciliation (post `semse-agents-governance`, PR #648/#649)
- **Affected domains:** `packages/agents`, `packages/forge`, `apps/api/src/modules/prometeo`, `packages/schemas`

## Context

`docs/specs/prometeo/tool-registry-governance.spec.md:158-170` (SPEC-GTW-F2) flagged, as an unresolved risk for a future ADR: *"ya existen 3 motores `allow|deny|require_approval` (Forge, `@semse/agents`, y el nuevo de F2) con formas convergentes pero vocabularios divergentes y sin interfaz común."* The `.claude/skills/semse-agents-governance/SKILL.md` reconciliation traced this precisely and found a **4th** engine the spec didn't count (`packages/agents/src/action-policy.ts`). This ADR is the decision that spec asked for.

## Existing implementations found

Four independently-evolved decision functions, each with real, verified production call sites (file:line, traced in the reconciliation, not assumed):

| # | Function | Call sites | Decision axis | Approval vocabulary |
|---|---|---|---|---|
| 1 | `evaluateAgentPolicy` (`packages/agents/src/governance.ts:873-959`) | `runtime.ts:770,875`, `agents.service.ts:189,253` | agent capability-manifest + computed risk score | free-text rule IDs (`requiredApprovals: string[]`) |
| 2 | `getActionPolicy`/`resolveApprovalMode` (`packages/agents/src/action-policy.ts:25-37`) | `project-copilot.harness.ts`, `agent-work-plan.service.ts:154` | static table keyed only by `AgentActionType`; no agent/risk concept; **never denies** | `none\|recommended\|required` |
| 3 | `evaluateForgePolicy` (`packages/forge/src/policy.ts:86-155`) | `forge/orchestrator.ts:158`, `packages/agents/src/runtime.ts:467`, `forge.service.ts` | agent-role + file/branch scope + spec-approval-status (richest — can require several approval modes at once) | 5-value `ForgeApprovalMode` |
| 4 | `evaluatePrometeoToolPolicy` (`apps/api/src/modules/prometeo/tool-governance/tool-governance.policy.ts:11-28`) | `prometeo-tool-execution.service.ts:145,234` | RBAC permission-match + a static per-tool approval tier | collapses the schema's 4-tier `approvalPolicy` into one `require_approval` bucket (confirmed data loss; see its own test `T-012b`) |

## Options considered

### Option A — Merge into one universal `ApprovalPolicyEvaluator`
Rejected. The four engines do not share an input shape: #1 needs an `AgentCapabilityManifest` and a computed risk score, #2 needs only a static `AgentActionType`, #3 needs file paths/branch/spec-approval-status, #4 needs RBAC roles and a per-tool descriptor. A universal interface would either (a) become a superset type most engines mostly ignore, reintroducing the "convergent shape, divergent vocabulary" problem the spec already flagged, or (b) force business rules that are genuinely domain-specific (Forge's branch protection, Prometeo's RBAC gate) out of their owning module and into a shared abstraction, which SPEC-GTW-F2 explicitly warned against ("Extraer cualquiera de los dos ... sería un refactor no relacionado y más grande que el propio F2").

### Option B — Leave all four exactly as-is, do nothing
Rejected. Doing nothing leaves the outer `decision` field's meaning implicit and un-typed across four call sites that a future engineer will reasonably expect to compose (e.g. "what's the final decision for this agent run" needs to read more than one of these). It also leaves Engine 2's fundamentally different shape (no `decision`, never denies) undocumented as a hazard.

### Option C — `Approval Protocol` with a shared `decision`-only contract, domain-owned rule engines underneath (chosen)
```text
Approval Protocol (decision: allow | deny | require_approval)
        │
        ├── Business Action Approval   → evaluateAgentPolicy (packages/agents)
        ├── Agent Autonomy Approval    → getActionPolicy (packages/agents, no deny state — see below)
        ├── Forge Change Approval      → evaluateForgePolicy (packages/forge)
        └── Prometeo Tool Approval     → evaluatePrometeoToolPolicy (apps/api/prometeo)
```
Each branch keeps its own rule ownership and vocabulary. Only the shared outer shape is unified.

## Decision

`ADAPT` for engines #1, #3, #4. `KEEP_DOMAIN_SPECIFIC` (not `REPLACE_DUPLICATE`) for all four rule engines — none is retired or merged. `RETIRE` does not apply to any engine in this pass (all four have real, live call sites).

**Already implemented** (PR #649, merged before this ADR was written — the code preceded the formal record, per the reconciliation's own iterative process): `packages/schemas/src/policy-decision.types.ts` exports:
```ts
export const policyDecisionOutcomes = ["allow", "deny", "require_approval"] as const;
export type PolicyDecisionOutcome = (typeof policyDecisionOutcomes)[number];
export interface PolicyDecisionBase { decision: PolicyDecisionOutcome; }
```
Compile-time-only contracts (`packages/agents/src/policy-decision-contract.ts`, `apps/api/src/modules/prometeo/tool-governance/policy-decision-contract.ts`) prove engines #1, #3, #4 structurally satisfy `PolicyDecisionBase`, without either engine importing the other's richer payload.

**Engine #2 (`action-policy.ts`) is explicitly excluded from `PolicyDecisionBase`.** It has no `decision` field — it returns `{ approvalMode, riskLevel }` and never denies anything; it labels a proposed `AgentAction` for a UI/reviewer, it does not gate execution. Forcing a synthetic `decision` onto it (e.g. mapping `approvalMode: "required"` to `"require_approval"`) would misrepresent behavior it doesn't have — there is no `"deny"` equivalent for `getActionPolicy` to map from. If Engine #2's job (risk→approval-mode labeling for Project Copilot proposals) needs to become a real gate in the future, that is a separate, explicit product decision — not a mechanical extension of this ADR.

## Why

- **One shared vocabulary, four owned rule sets** matches how the codebase already actually behaves — every attempt to find a deeper unification surfaced a genuine domain difference (file/branch scope, RBAC permission-match, agent-capability+risk), not an accidental duplication.
- **`PolicyDecisionBase` is additive and non-breaking** — no engine's existing return type changed shape; the contract files are compile-time-only and erased by `tsc`.
- **Excluding Engine #2 honestly** avoids the exact anti-pattern this ADR exists to prevent: inventing convergence that isn't real.

## Invariants

- No engine's approval-mode payload (`requiredApprovals: string[]` / `ForgeApprovalMode[]` / `AgentApprovalMode` / the collapsed Prometeo tier) may be read or written by another engine's module. Only `decision` crosses the boundary.
- A future 5th policy engine in this codebase should default to satisfying `PolicyDecisionBase` on its outer decision, and must not be assumed compatible with any existing engine's approval-mode vocabulary without the same call-site tracing this ADR did.
- Engine #2 must never be treated as authoritative for "is this action allowed" — only `evaluateAgentPolicy`/`evaluateForgePolicy`/`evaluatePrometeoToolPolicy` gate execution today.

## Migration plan

None required — `PolicyDecisionBase` and its two contract files are already merged (PR #649). No existing engine's logic changed.

## Compatibility

- **API:** none — internal TypeScript types only, no wire format changed.
- **Mobile:** not applicable.
- **Events:** none.
- **Database:** none.
- **Workflows:** none.

## Risks

- A future engineer could still misread `PolicyDecisionBase` as "the" approval contract and try to compare decisions across engines for requests that are not actually comparable (different actor/resource/action shapes). See ADR-037's Golden Approval Consistency Scenario finding for the one case in this codebase where two engines' decisions for the *same* request must be combined correctly (Forge's dual-gate).

## Verification

- `pnpm --filter @semse/schemas build`, `@semse/forge build`, `@semse/agents build`, `@semse/api build` all pass with the compile-time contracts in place.
- Existing test suites for all four engines pass unchanged: `forge-harness.test.mjs` (14), `apps/api/test/agent-governance.test.ts` (3), `apps/api/test/agents.controller.test.ts`, `apps/api/test/prometeo-tool-governance.policy.test.ts` (6).

## Rollback

Delete `packages/schemas/src/policy-decision.types.ts`, its barrel export, and the two `policy-decision-contract.ts` files. Zero runtime behavior depends on them (compile-time only), so this is a clean, zero-risk rollback.

## Deferred (explicitly out of scope for this ADR)

- Whether Engine #2 (`action-policy.ts`) should become a real gate with a `deny` state — a product decision, not an architecture one.
- Registering these four engines' governed roles/tools as `Capability` rows in the ADR-032 Capability Reality Registry — see ADR-037.
- Any change to Forge's, Prometeo's, or the generic agent policy's actual business rules.
