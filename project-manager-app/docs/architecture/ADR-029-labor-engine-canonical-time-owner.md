# ADR-029 — Labor Engine is the sole canonical owner of time/labor commands

- **Date:** 2026-09-14
- **Status:** Accepted
- **Owners:** SEMSE Execution Program, Phase 0 (D05)
- **Affected domains:** Labor Engine, Field Ops (Time Tracker), Worker mobile app

## Context

Two independent time-command paths exist:

- `apps/api/src/modules/labor-engine/*` — `labor-engine.service.ts`, `labor-engine.repository.ts`, `labor-engine.controller.ts`, `labor-chat.service.ts`. This matches `01_CURRENT_BASELINE_AND_NON_NEGOTIABLES.md`'s own stated intent ("D05 — one owner for time commands (Labor Engine)").
- `apps/api/src/modules/field-ops/time-tracker.controller.ts` — uses its own `FieldOpsService`, does not import `LaborEngineService`.

This area has direct production incident history: a project-memory record (2026-07-27, "migraciones fantasma") documents a Time Tracker outage caused by phantom migration rows, later repaired via `repairPhantomMigrations()` in `scripts/pre-migrate.mjs`. Any consolidation here must be handled with more caution than a typical duplicate-cleanup, given that history.

## Existing implementations found

- `apps/api/src/modules/labor-engine/{labor-engine.service.ts, labor-engine.repository.ts, labor-engine.controller.ts, labor-chat.service.ts, labor-engine.module.ts}`
- `apps/api/src/modules/field-ops/time-tracker.controller.ts` (+ `field-ops.service.ts`)
- `apps/mobile/src/screens/TimerScreen.tsx` (client of one or both of the above — not confirmed which during Phase 0)

## Options considered

### Option A — REPLACE_DUPLICATE field-ops/time-tracker immediately
Rejected outright as a first move: given the July 2026 Time Tracker incident history, a one-shot replacement without regression coverage is exactly the failure mode that caused that incident.

### Option B — REUSE/EXTEND Labor Engine as canonical + ADAPT field-ops/time-tracker into a capture surface (chosen)

### Option C — Leave both as permanently separate systems
Rejected: violates the one-source-of-truth invariant and the baseline doc's explicit D05 intent; also means future time-related bugs must be chased across two independent implementations.

## Decision

`REUSE/EXTEND Labor Engine + ADAPT field-ops/time-tracker`.

Labor Engine (`modules/labor-engine/*`) is the sole canonical owner of time/labor commands: start, pause, resume, stop, and manual time entry. `field-ops/time-tracker.controller.ts` becomes a capture surface/adapter for worker/field-facing UX — it may keep its own controller/routes for mobile ergonomics, but every mutating time command it accepts must converge on Labor Engine's command surface rather than `FieldOpsService` maintaining independent time-state logic.

## Why

- Matches the baseline doc's own already-stated architectural intent (D05) — this ADR formalizes and evidences a decision that was already implied, not invents a new one.
- Given the incident history, an adapter-around-canonical-engine shape (rather than deletion) lets field-ops keep whatever mobile/offline-specific handling it has today while migrating the actual state ownership incrementally.

## Invariants

- No time command may mutate authoritative time-entry state outside Labor Engine once migration completes.
- Idempotency of time commands (start/stop/manual-entry retries) must be preserved or improved through migration, never weakened.
- Offline-captured time entries (if field-ops/mobile supports offline capture) must still reconcile correctly against Labor Engine after migration — this is explicitly named as a requirement, not assumed.

## Migration plan

1. **Before any code change:** write a regression test suite that captures the July 2026 incident's failure mode (phantom/duplicate time-entry rows surviving a failed or repeated migration/write) against the *current* combined behavior of Labor Engine + field-ops/time-tracker, so regressions are caught by CI rather than production.
2. Enumerate `field-ops/time-tracker.controller.ts`'s mutating endpoints (start/pause/resume/stop/manual-entry) and their current data path through `FieldOpsService`.
3. For each, add a call into Labor Engine's equivalent command, running both paths in parallel (dual-write or shadow-read) if warranted by risk, before removing the `FieldOpsService`-owned state.
4. Confirm mobile client (`TimerScreen.tsx`) behavior is unaffected by the adapter change — no client-visible contract break.
5. Remove `FieldOpsService`'s independent time-state ownership only after step 1's regression suite and step 3's parallel-path verification both pass. No destructive one-shot replacement.

## Compatibility

- **API:** `field-ops/time-tracker` routes should remain stable for mobile clients; only the backing implementation changes.
- **Mobile:** `TimerScreen.tsx` and any offline queue/sync logic must be re-verified against the adapted backend before shipping.
- **Events:** if either path emits domain events for time entries, ensure only one canonical event is emitted post-migration (avoid duplicate-event risk, itself one of the ledger's "Golden Regressions" checks).
- **Database:** no schema change designed in this ADR; if field-ops has its own time-entry table(s) distinct from Labor Engine's, a data-migration plan is required before that table can be retired — not designed here.
- **Workflows:** none identified.

## Risks

- Highest-risk ADR in this batch given direct incident history. Under-testing the migration risks repeating the July 2026 outage class.
- Offline/idempotency behavior differences between the two paths may not surface until real field conditions (poor connectivity) are exercised — synthetic tests alone may be insufficient; recommend a canary/flag-gated rollout.

## Verification

- Regression suite for the July 2026 failure mode, written and green *before* migration starts (step 1).
- Contract tests confirming field-ops-originated time commands produce identical Labor Engine state as Labor-Engine-originated commands.
- `pnpm --filter @semse/api build` and relevant unit tests green after each migration step.
- Canary/flag-gated production rollout recommended given incident history; full verification plan to be detailed at Phase-1+ implementation time, not in this Phase-0 ADR.

## Rollback

Keep the migration behind a feature flag if risk warrants (per `06_MIGRATION_DEPLOYMENT_ROLLBACK.md`'s general guidance); disable the flag to fall back to `field-ops`-owned state if a regression is detected post-deploy. Each migration step should be its own revertible commit.
