-- Phase 1, batch 4: wire three more golden regressions to real automated tests.
--
-- cross-tenant-isolation is now PASSING: apps/api/test/agro-farm.service.test.ts
-- already covers F02b (2026-09-11 audit) — AgroFarmService.getUnit()/updateUnit()
-- reject a caller whose ownerId doesn't match the farm's owner with the same
-- NotFoundException used for a missing resource (no existence leak). 17/17 passing.
--
-- duplicate-event-dedupe is now PASSING: apps/api/test/event-domain-consumer-integration.test.ts
-- (F1-D) proves concurrent/re-delivered domain events are deduped by idempotencyKey —
-- a second delivery returns { duplicate: true } with no additional side effect. Verified
-- 4/4 passing against a live scratch Postgres with all migrations applied.
--
-- offline-conflict-resolution stays NOT_WIRED -> FAILING, not PASSING: it is genuinely
-- unmet. tests/unit/offline-conflict-resolution.test.mjs (a `test.todo`) proves
-- apps/mobile/src/screens/TimerScreen.tsx silently prefers the local timer when it
-- conflicts with a different remote session, surfacing only the same generic
-- "offlineMode" banner used for plain no-connectivity — the conflict itself is never
-- distinctly surfaced to the actor. See SEMSE_EXECUTION_LEDGER.md Blockers; the UX
-- decision for what "surfaced" should look like on this screen is out of scope here.
--
-- privacy-local-only-fallback, duplicate-command-rejection and stale-approval-rejection
-- stay NOT_WIRED: no real implementation was found for any of the three as literally
-- worded (no multi-tenant local-cache fallback layer; no client-facing command-level
-- idempotency layer outside internal event-emission keys; expectedVersion only exists
-- in live-sessions, not an approval flow) — under-claiming instead of forcing a fit.
UPDATE "golden_regression"
SET
  "testReference" = 'apps/api/test/agro-farm.service.test.ts',
  "status" = 'PASSING',
  "lastCheckedAt" = CURRENT_TIMESTAMP,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'gr_cross_tenant_isolation';

UPDATE "golden_regression"
SET
  "testReference" = 'apps/api/test/event-domain-consumer-integration.test.ts',
  "status" = 'PASSING',
  "lastCheckedAt" = CURRENT_TIMESTAMP,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'gr_duplicate_event';

UPDATE "golden_regression"
SET
  "testReference" = 'tests/unit/offline-conflict-resolution.test.mjs',
  "status" = 'FAILING',
  "lastCheckedAt" = CURRENT_TIMESTAMP,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'gr_offline_conflict';
