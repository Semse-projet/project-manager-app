# ADR-028 — Evidence: evidence/* is canonical; evidence-gateway/* becomes an integration adapter only

- **Date:** 2026-09-14
- **Status:** Accepted
- **Owners:** SEMSE Execution Program, Phase 0 (D04)
- **Affected domains:** Evidence, Evidence Gateway, Agro (evidence sub-path), Vision

## Context

Two full Evidence stacks exist:

- `apps/api/src/modules/evidence/*` — `evidence.service.ts`, `evidence.repository.ts`, `evidence.policy.ts`, `evidence.controller.ts`, `evidence-exif.ts`.
- `apps/api/src/modules/evidence-gateway/*` — `evidence-gateway.service.ts` (uses its own `EvidenceGatewayRepository`, imports `VisionService`/`StorageService`/`SseEventBusService` directly), `evidence-gateway.repository.ts`, `evidence-gateway.controller.ts`.

`apps/api/src/modules/agro/agro-evidence.*` is a third, domain-specific stack whose relationship to the canonical Evidence domain was not fully inspected during Phase-0 reconciliation and is called out separately below.

`01_CURRENT_BASELINE_AND_NON_NEGOTIABLES.md` §1.5 names "Evidence/file approval → Evidence" as a one-source-of-truth concept.

## Existing implementations found

- `apps/api/src/modules/evidence/{evidence.service.ts, evidence.repository.ts, evidence.policy.ts, evidence.controller.ts, evidence-exif.ts, evidence.module.ts}`
- `apps/api/src/modules/evidence-gateway/{evidence-gateway.service.ts, evidence-gateway.repository.ts, evidence-gateway.controller.ts, evidence-gateway.module.ts, evidence-gateway.service.spec.ts}`
- `apps/api/src/modules/agro/{agro-evidence.controller.ts, agro-evidence.repository.ts, agro-evidence.service.ts}`
- `apps/api/src/modules/operational-intelligence/evidence-review.service.ts` (consumer, not an owner)
- `apps/api/src/modules/semse-agents/evidence.agent.ts` (consumer, not an owner)

## Options considered

### Option A — REPLACE_DUPLICATE (delete evidence-gateway)
Rejected: evidence-gateway wires `VisionService` and `SseEventBusService` in ways that look like a real integration/ingestion concern (external/vision-sourced evidence, real-time event fan-out), not pure duplication for its own sake. Deleting it risks losing a legitimate integration surface.

### Option B — REUSE evidence/* as canonical + ADAPT evidence-gateway/* into an adapter (chosen)

### Option C — Merge both into one mega-module
Rejected: would couple ingestion/integration concerns (vision, SSE, external channels) directly into the core Evidence domain module, increasing blast radius of core Evidence changes.

## Decision

`REUSE + ADAPT`.

`modules/evidence/*` is the canonical owner of the Evidence lifecycle: state, registration, replacement, archive, approval, and references. `modules/evidence-gateway/*` is retained **only** as an integration gateway/adapter for other domains/channels (vision pipeline, SSE fan-out, external submission surfaces). It may not keep a second authoritative registry or lifecycle, and may not make approval/rejection/state decisions that contradict or bypass the canonical Evidence domain. Every submit/register/replace/approve/reject operation — regardless of which controller receives the request — must terminate in the same canonical `evidence/*` contract.

`agro-evidence.*` is out of scope for this ADR's decision (not enough evidence gathered in Phase 0 to classify it); it needs its own focused inspection before Phase 1 touches Evidence, flagged as a follow-up below rather than decided here.

## Why

- Preserves "one source of truth" for Evidence approval/lifecycle state while keeping the genuinely useful integration surface (vision/SSE wiring) evidence-gateway already provides.
- Avoids a destructive deletion of code that may be load-bearing for vision-sourced evidence ingestion without first confirming what calls it.
- Matches the general pattern already correct elsewhere in the repo (D02's gate-service pattern: `waiver-payment-gate.service.ts` is a pre-check gate around the canonical release path, not a competing release path) — evidence-gateway should follow the same "adapter around canonical domain" shape.

## Invariants

- `evidence-gateway.repository.ts` must not be the system of record for evidence state once migration completes; `EvidenceRepository` is.
- Any evidence-gateway endpoint that currently writes evidence records directly must instead call into `evidence/*`'s service/command surface.
- Vision/SSE integration behavior evidence-gateway provides today must be preserved — this is an ownership/authority change, not a feature removal.

## Migration plan

1. Enumerate every write path in `evidence-gateway.service.ts` / `evidence-gateway.repository.ts` and classify each as (a) genuine integration-only concern (keep in gateway) or (b) evidence state/lifecycle mutation (must move to call `evidence/*`).
2. For (b) paths, replace direct `EvidenceGatewayRepository` writes with calls into `evidence/*`'s service, preserving the gateway's vision/SSE side-effects around that call.
3. Add contract tests asserting a submission through evidence-gateway produces the identical canonical evidence record shape as a submission through `evidence/*` directly.
4. Separately, inspect `agro-evidence.*` and decide REUSE/ADAPT/REPLACE_DUPLICATE for it — tracked as a Phase-0 follow-up, not resolved by this ADR.
5. No destructive one-shot replacement — incremental, per write-path.

## Compatibility

- **API:** evidence-gateway's existing endpoints/routes should keep working; only their internal implementation changes to delegate to canonical Evidence.
- **Mobile:** verify no mobile client depends on evidence-gateway-specific record shape that would change once delegated.
- **Events:** SSE fan-out behavior must be preserved through the adapter change.
- **Database:** no immediate schema change required; if `EvidenceGatewayRepository` has its own tables, a data-migration/backfill plan is needed before decommissioning them — not designed in this ADR.
- **Workflows:** none identified.

## Risks

- Vision-sourced evidence may have fields/metadata canonical `evidence/*` doesn't yet model — must be surfaced during step 1's audit rather than dropped silently.
- `agro-evidence.*` may itself depend on `evidence-gateway.*` internals — check before touching either.

## Verification

- Contract tests per migration step 3.
- `pnpm --filter @semse/api build` and relevant unit tests green after each write-path migration.
- Manual verification that a vision-sourced evidence submission still appears correctly in the canonical Evidence UI/approval flow post-migration.

## Rollback

Each write-path migration should be its own small, revertible commit; revert the specific commit if a path's delegation breaks the gateway's integration behavior.
