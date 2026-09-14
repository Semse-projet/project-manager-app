# ADR-027 — Canonical economic evaluator: consolidate pricing/* and contractor-estimate

- **Date:** 2026-09-14
- **Status:** Accepted
- **Owners:** SEMSE Execution Program, Phase 0 (D03)
- **Affected domains:** Pricing, Contractor, Finance

## Context

Two independent economic-calculation paths exist in `apps/api/src/modules`:

- `pricing/material-pricing.service.ts` and `pricing/location-cost.service.ts` — deterministic material/location pricing.
- `contractor/contractor-estimate.service.ts` — builds contractor estimates by calling `AiModelGatewayService` and `FinanceService` directly, with no dependency on `pricing/*`.

This means the same "what does this cost" question can produce two different, independently-evolving answers depending on which code path a caller uses. `01_CURRENT_BASELINE_AND_NON_NEGOTIABLES.md` §1.5 requires one source of truth per concept and states AI is not final authority over deterministic calculations.

## Existing implementations found

- `apps/api/src/modules/pricing/material-pricing.service.ts`
- `apps/api/src/modules/pricing/location-cost.service.ts`
- `apps/api/src/modules/pricing/pricing.controller.ts`, `pricing.module.ts`
- `apps/api/src/modules/contractor/contractor-estimate.service.ts` (174 lines, imports `AiModelGatewayService`, `FinanceService`, `ContractorService` — no import from `pricing/*`)
- `packages/tools/src/trades/*.engine.ts` (electrical, plumbing, solar, fencing, tile) each embed their own material/cost logic via `packages/tools/src/core/cost-engine.ts` — a third pricing surface, out of scope for this ADR but noted for Phase-1 follow-up since it may also need to converge on the same canonical engine eventually.

## Options considered

### Option A — REPLACE_DUPLICATE
Delete `contractor-estimate.service.ts`'s independent economic logic outright and force immediate migration to `pricing/*`.

### Option B — EXTEND pricing/* + ADAPT contractor-estimate (chosen)
Make `pricing/*` the canonical economic/pricing engine. Compare capabilities, migrate any pricing capability `contractor-estimate.service.ts` has that `pricing/*` lacks, add regression tests, then adapt `contractor-estimate.service.ts` to consume `pricing/*` for all deterministic cost figures, keeping only AI-driven estimate narrative/orchestration and contractor-specific sequencing logic.

### Option C — Leave both, document boundary
Rejected: does not resolve the "two answers" risk; contradicts the one-source-of-truth invariant.

## Decision

`EXTEND pricing/* + ADAPT contractor-estimate.service.ts`.

`modules/pricing/*` becomes the canonical economic/pricing engine for all deterministic cost/pricing figures. `contractor-estimate.service.ts` stops maintaining independent economic calculations; it may keep AI-driven narrative generation, scope interpretation and contractor-specific orchestration, but every dollar figure it returns must originate from `pricing/*`.

## Why

- Preserves the "AI is not final authority" invariant: `contractor-estimate.service.ts`'s AI-gateway path currently has no deterministic backstop for its cost figures.
- `pricing/*` is the smaller, more clearly-scoped, non-AI-coupled implementation — safer canonical base than trying to extract pricing logic out of an AI-orchestration service.
- Incremental (Option B) avoids a big-bang rewrite of a live estimate flow.

## Invariants

- Every generated estimate's cost total must be traceable to a single `pricing/*` computation, not an independently-derived AI/heuristic number.
- AI may adjust framing/narrative/upsell text around the number; it may not silently alter the number itself.

## Migration plan

1. Audit `contractor-estimate.service.ts`'s current cost-calculation code paths and diff against `pricing/*` capabilities (materials covered, location multipliers, labor rates).
2. Port any missing capability into `pricing/*` (e.g. contractor-specific labor rate tables), with tests.
3. Add regression tests pinning `contractor-estimate.service.ts`'s current outputs for known inputs, so the migration is provably non-regressive.
4. Switch `contractor-estimate.service.ts` to call `pricing/*` for cost figures; remove its independent economic calculation code once parity tests pass.
5. Do not remove/deprecate the duplicate logic until step 4's tests are green — no destructive one-shot replacement.

## Compatibility

- **API:** `contractor-estimate.service.ts`'s public response shape should be preserved; only the internal cost source changes.
- **Mobile:** no direct impact expected; verify no mobile client reads contractor-estimate internals that would change shape.
- **Events:** none known to depend on this today.
- **Database:** no schema change required for this ADR.
- **Workflows:** none identified.

## Risks

- Parity gaps between the two pricing logics could shift estimate numbers for existing in-flight estimates/contracts — must be caught by the parity tests in step 3, not discovered in production.
- `pricing/*` may lack contractor-specific line items (e.g. margin/markup conventions) not yet modeled — must be surfaced during the audit, not assumed away.

## Verification

- Parity test suite comparing old vs new contractor-estimate outputs for a fixed set of representative inputs before the switch.
- `pnpm --filter @semse/api build` and relevant unit tests green.
- Manual sanity check of at least one real estimate flow post-migration before considering this ADR's migration complete (separate from this Phase-0 ADR, tracked as Phase-1+ implementation work).

## Rollback

Revert `contractor-estimate.service.ts` to its pre-migration commit; `pricing/*` additions are additive and can remain even if the switch is rolled back.
