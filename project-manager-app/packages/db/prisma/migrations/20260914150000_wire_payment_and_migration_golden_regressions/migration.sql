-- Phase 1, batch 2: wire two golden regressions to real automated tests.
--
-- migration-startup-safety is now PASSING: tests/unit/pre-migrate-startup-safety.test.mjs
-- reproduces the P3009 shape (a _prisma_migrations row with finished_at/rolled_back_at
-- both NULL) against a live Postgres and asserts scripts/pre-migrate.mjs exits non-zero
-- with a clear FATAL log instead of proceeding or failing silently.
--
-- payment-release-canonical-path stays FAILING, not PASSING: it is genuinely broken.
-- tests/unit/payment-release-canonical-path.test.mjs (a `test.todo`) proves
-- PaymentGovernanceService.releasePayment() — live at POST /v1/payments/release — never
-- calls Stripe/EscrowReleaseService, so a second, non-canonical payment-release path
-- exists in production today. See SEMSE_EXECUTION_LEDGER.md Blockers for the D02 decision
-- this requires; that decision and its implementation are explicitly out of scope here.
UPDATE "golden_regression"
SET
  "testReference" = 'tests/unit/pre-migrate-startup-safety.test.mjs',
  "status" = 'PASSING',
  "lastCheckedAt" = CURRENT_TIMESTAMP,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'gr_migration_startup';

UPDATE "golden_regression"
SET
  "testReference" = 'tests/unit/payment-release-canonical-path.test.mjs',
  "status" = 'FAILING',
  "lastCheckedAt" = CURRENT_TIMESTAMP,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'gr_payment_release_canonical';
