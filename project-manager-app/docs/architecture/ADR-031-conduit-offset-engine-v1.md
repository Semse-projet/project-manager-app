# ADR-031 — Conduit Offset Engine V1: CREATE a shared, deterministic bend-geometry module

- **Date:** 2026-09-14
- **Status:** Accepted
- **Owners:** SEMSE Execution Program, Phase 0 → Phase 4 foundation
- **Affected domains:** Electrical/ProTools, Field, Mobile (future consumer)

## Context

`01_CURRENT_BASELINE_AND_NON_NEGOTIABLES.md` §1.6 names conduit offset/bending as the first field vertical's core regression: `offset=6in, angle=30deg -> spacing=12in`, formula `spacing = offset / sin(angle)`, with an explicit rule that an unverified bender must never produce a fabricated exact arrow/star/tool-specific marking.

A focused, repo-wide search (mobile, ProTools/semse-agents modules, `packages/tools`, `packages/shared`) for `offset`, `conduit`, `bend`, `bender`, `Math.sin`/`sin(`, `shrink`, `EMT` found:

- `packages/tools/src/trades/electrical/electrical.engine.ts` — a real, mature electrical engine, but for **load/wire-sizing/cost estimation** (amperage, wire gauge, breaker selection, voltage drop, material takeoff). It contains no offset/bend-geometry logic at all.
- No other match anywhere in `apps/api`, `apps/mobile`, `packages/tools`, or `packages/shared` relates to conduit bending geometry.

This confirms the deterministic conduit-offset/bend engine **does not exist anywhere in the codebase**, despite the baseline document's framing that the Electrical vertical "has already produced real field data and real failure cases" — that domain knowledge, if it exists, is not yet encoded as a reusable engine.

## Existing implementations found

None for the specific offset/bend-geometry concern. The adjacent (but distinct) `electrical.engine.ts` was inspected and confirmed non-overlapping — it is not renamed/extended, it stays intact, as a sibling concern.

## Options considered

### Option A — Embed the formula in a Prometeo/AI prompt or tool-call handler
Rejected outright: `01_CURRENT_BASELINE_AND_NON_NEGOTIABLES.md` §1.5 states AI is not final authority over deterministic calculations; a formula embedded in an LLM-facing layer is neither reusable nor guaranteed deterministic across model versions.

### Option B — Private function inside a single mobile screen
Rejected: not reusable from `apps/api`, would duplicate the formula the first time any other surface (web ProTools, an API endpoint, a future report) needs it — exactly the kind of duplication `01_CURRENT_BASELINE_AND_NON_NEGOTIABLES.md` warns against.

### Option C — New pure module inside the existing `@semse/tools` package (chosen)
`@semse/tools` has zero runtime dependencies (only a `typescript` devDependency), is pure ESM/TS with no Node-only or NestJS-specific APIs, and already contains the sibling `electrical.engine.ts`. It is currently consumed by `apps/api`; nothing about its shape prevents `apps/mobile` from depending on it in the future via the pnpm workspace, without duplicating the formula.

## Decision

`CREATE`.

Added `packages/tools/src/trades/electrical/conduit-offset.engine.ts` as a single pure, shareable module, exported from `@semse/tools`'s public index. It provides:

- `calculateConduitOffset({ offsetIn, angleDeg })` — canonical geometry: `spacingIn = offsetIn / sin(angleDeg)` and a clearly separate `theoreticalShrinkIn = offsetIn * tan(angleDeg / 2)`, never conflated with each other.
- `assertBenderVerifiedForMarking(bender)` — a hard guard (throws `UnverifiedBenderError`) that must pass before any caller may synthesize exact tool-specific marking output. Geometry remains available regardless of bender verification status.

This is V1 scope only: the engine computes geometry and enforces the marking gate. It does **not** wire into ProTools UI, mobile screens, or any API endpoint — that integration is explicitly Phase-4 scope, kept out of this batch to keep the change small and reviewable.

## Why

- Satisfies "importable from both apps/api and apps/mobile without duplicating the formula" using existing, already-proven-safe package infrastructure rather than standing up a new package with its own build/publish wiring.
- The hard-guard-via-thrown-error shape for the bender check means the block cannot be silently skipped by a caller forgetting an `if` check — satisfies the baseline's "unknown/unverified bender must not produce invented exact...marking" rule at the type/runtime level, not just as documentation.
- Keeping `theoreticalShrinkIn` as a distinctly-named field (never returned as or merged into `spacingIn`) directly encodes the baseline's warning that theoretical shrink may only be shown as theoretical geometry, never conflated with the canonical spacing result.

## Invariants

- `spacingIn` must always equal `offsetIn / sin(angleDeg)` exactly (mathematically) for valid inputs — this is the golden regression and must never silently change formula.
- `theoreticalShrinkIn` must never be substituted for `spacingIn` anywhere downstream.
- No code path may produce tool-specific marking output without first passing `assertBenderVerifiedForMarking`.

## Migration plan

Not applicable — this is new code with no prior callers to migrate. Phase-4 work that wires this into ProTools/mobile UI should treat this ADR's exported surface (`calculateConduitOffset`, `assertBenderVerifiedForMarking`, associated types/errors) as stable and additive-only going forward.

## Compatibility

- **API:** no endpoint wired in this batch; future Phase-4 endpoints should call this engine rather than reimplementing the formula.
- **Mobile:** `@semse/tools` is not yet a mobile dependency; adding it is a trivial workspace-dependency addition when Phase-4 mobile work needs it — no blocker identified.
- **Events:** none.
- **Database:** none — this is a pure calculation, no persistence.
- **Workflows:** none.

## Risks

- Low — new, isolated, pure-function module with no existing callers to break.
- Future risk: if Phase-4 work embeds marking-synthesis logic that bypasses `assertBenderVerifiedForMarking` (e.g. by catching and swallowing `UnverifiedBenderError` to proceed anyway), the invariant would be violated at the call site rather than the engine — code review for Phase-4 PRs touching this area should specifically check for this.

## Verification

- `packages/tools/test/conduit-offset.test.ts`: golden case (`6in @ 30deg = 12in`), formula-match test for a non-golden case, theoretical-shrink-is-distinct test, invalid-input rejection tests, and both branches of the bender-verification guard (blocked when unverified, passes when verified).
- `pnpm --filter @semse/tools build` and `pnpm --filter @semse/tools test` green.

## Rollback

New, additive module with zero existing callers — rollback is simply reverting the commit; nothing else depends on it yet.
