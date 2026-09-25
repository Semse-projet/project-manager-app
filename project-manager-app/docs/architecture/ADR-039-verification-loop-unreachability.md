# ADR-039 — Verification Loop (SPEC-AGT-001) Structural Unreachability (AG-05)

- **Date:** 2026-09-18
- **Status:** Accepted
- **Owners:** Agents Governance Reconciliation, follow-up investigation after ADR-038
- **Affected domains:** `packages/agents/src/runtime.ts`, `packages/agents/src/verification.ts`, `packages/agents/src/verifiers.ts`, `docs/specs/agents/verification-loop.spec.md` (SPEC-AGT-001)

## Context

While surveying the repo for other gaps in the same shape as ADR-037/038 (real, tested, registered subsystem with zero production activation), this investigation re-examined `semse-agents-governance`'s own already-flagged note: *"the verification loop is real, tested code that structurally cannot activate from any current call site."* That note was written during the original skill research and never turned into a decision record. This ADR verifies it directly against source (not against the skill's prose) and records the finding formally.

SPEC-AGT-001 (`docs/specs/agents/verification-loop.spec.md`) designed a closed act→verify→fix loop for write-shaped agent runs, and the code faithfully implements that design: `VerificationBudget`/`VerifierName`/`VerificationReport` contracts, a real verifier registry over `spawnSync` (reusing `packages/autonomy/src/validator.ts`'s pattern), and the loop itself in `executeGovernedAgentRun`. The spec's own frontmatter marks it `status: "IMPLEMENTED"` — but the spec's own body header still reads *"Estado: DRAFT → listo para bloque en PROTOOLS_MASTER_PLAN"*, an internal inconsistency this ADR does not resolve (see Deferred) but flags as a symptom of the same underlying problem: "implemented" was never checked against "reachable."

## Existing implementations found

Verified directly, not assumed:

- `executeGovernedAgentRun`'s input type declares `actionType?: string` with its own doc comment: *"SPEC-AGT-001: actionType declarado del run. Default `runtime.execute`"* (`runtime.ts:758-759`).
- The gate: `const declaredActionType = input.actionType ?? "runtime.execute"; const isWriteRun = isWriteActionType(declaredActionType);` (`runtime.ts:831-832`).
- `WRITE_ACTION_TYPES` (`verification.ts:107-113`): `{code.write, file.write, data.write, config.write, doc.write}` plus anything ending in `.write` (`isWriteActionType`, `verification.ts:115-117`).
- The two real production callers of `executeGovernedAgentRun` (per ADR-037's own reachability map, the only two roles — `dispute` and `forge` — that reach `runtime.ts`'s own builder code):
  - `apps/worker/src/main.mjs:473-479` — calls with `{agentType, runId, correlationId, payload, environment}`. No `actionType`, no `verification`.
  - `apps/api/src/modules/forge/forge-agent-adapter.service.ts:56-62` — same: `{agentType: "forge", runId, correlationId, payload, environment}`. No `actionType`, no `verification`.
- Forge's own builder internally tags its *output* `actionType: "forge.evaluate"` (`runtime.ts:647`) — but this is assigned to the result, after the gate at line 831-832 already ran using the *input's* (absent) `actionType`. It cannot retroactively activate the loop for that same run, and `"forge.evaluate"` does not end in `.write` regardless.

**Consequence, confirmed by direct citation:** `declaredActionType` is always `"runtime.execute"` for every real run today, `isWriteActionType("runtime.execute")` is always `false`, and the entire act→verify→fix loop — real code, with its own passing tests (`tests/unit/verification-loop.test.ts` per the spec's `related_tests`) — has never executed once outside of a test, in Forge included, despite Forge being exactly the kind of write-shaped (code-patching) capability the loop was designed for.

## Options considered

### Option A — Wire a real caller to declare `actionType`/`verification` now (e.g. Forge → `code.write`)
Rejected for this ADR. Which real domains should get write-verification, with what `successCriteria`, is a product/design decision (per-role risk tolerance, which verifiers apply, budget sizing) — not something to slip in as a side effect of a reachability audit. It also touches Forge's live production path, which deserves its own scoped change and testing, not a rider on a documentation ADR.

### Option B — Treat it as done because the spec's frontmatter says `IMPLEMENTED`
Rejected. This is the exact anti-pattern the whole reconciliation exists to fix: a status field is not runtime evidence. The spec's own body still disagrees with its frontmatter, which is itself a signal that "implemented" was recorded at the design/code-complete step, not re-checked against a live call site.

### Option C — Record the reachability finding precisely, correct affected documentation's citations, and defer the activation decision (chosen)

## Decision

`KEEP_FOR_PLANNED_CAPABILITY` — no code deleted, no code added, no caller wired in this ADR. The loop's design and code are real, well-built, and match SPEC-AGT-001 faithfully; there is no evidence of abandonment, only of never having been connected to a real trigger.

If this capability is ever registered in the ADR-032 Capability Reality Registry, its maturity must cap at `TESTED` (real code + passing unit tests), not `INTEGRATED` or higher — no production-entrypoint chain reaches an activated state of this loop today, which is a stricter bar than "a handler exists," per the same evidence discipline ADR-037 applied to `RuntimeAgentRole`s.

## Why

- Matches the exact discipline ADR-037 already established for `RuntimeAgentRole` builders, applied here to a cross-cutting mechanism instead of a single role: unit-tested and spec-complete are not synonyms for production-reachable.
- Naming the real risk (Option A's Forge scenario) without acting on it now is more honest than silently leaving it undocumented — a future contributor patching Forge to pass `actionType: "code.write"` needs to know they would be the first to ever exercise this loop in production.

## Invariants

- Any future change that causes a real caller to pass a `WRITE_ACTION_TYPES`-matching `actionType` (Forge is the obvious first candidate, since it patches code) activates this loop for the first time in production — that PR must explicitly call this out in its description and must not assume the loop's unit tests are sufficient proof of production behavior.
- `executeGovernedAgentRun`'s `actionType` default (`"runtime.execute"`) must not be changed without re-auditing every real caller — changing the default is equivalent to activating the loop for every write-shaped role simultaneously, a far larger blast radius than opting one caller in explicitly.

## Migration plan

None — this ADR changes no code.

## Compatibility

- **API:** none.
- **Mobile:** not applicable.
- **Events:** none — `agent.verify`/`agent.fix.attempt` audit events remain real but unemitted in production, same as before this ADR.
- **Database:** none.
- **Workflows:** none.

## Risks

- The silent risk this ADR exists to name: the loop's `exhausted` path (budget exhaustion → forced `requiresHumanReview` + approval escalation) has never run against real traffic. If a future PR activates it without care, the first real exhaustion event is also the first production test of that escalation path.
- Leaving SPEC-AGT-001's frontmatter/body status inconsistency unresolved risks a future contributor trusting the frontmatter (`IMPLEMENTED`) at face value and building on top of an assumption this ADR just disproved.

## Verification

- `grep -n "actionType" packages/agents/src/runtime.ts` — confirms the default and the two production call sites' omission of the field.
- `grep -n "WRITE_ACTION_TYPES\|isWriteActionType" packages/agents/src/verification.ts` — confirms the exact write-type set and matcher.
- Direct read of `apps/worker/src/main.mjs:460-489` and `apps/api/src/modules/forge/forge-agent-adapter.service.ts:40-69` — confirms neither passes `actionType` or `verification`.

## Rollback

Not applicable — no code changed.

## Deferred (explicitly out of scope for this ADR)

- The product/design decision of which real write-shaped action (Forge's code-patching is the obvious first candidate) should declare an `actionType` and `VerificationBudget` to activate the loop, and with what `successCriteria`.
- Registering this capability in the ADR-032 Capability Reality Registry (proposed cap: `TESTED`, per Decision above) — a separate, small PR if pursued.
- Correcting SPEC-AGT-001's own internal status inconsistency (frontmatter `IMPLEMENTED` vs. body `DRAFT` header) — flagged here, not edited in this ADR; that spec belongs to its own owner (`semse-core`) and editing it is outside this reconciliation's scope without that owner's sign-off.
