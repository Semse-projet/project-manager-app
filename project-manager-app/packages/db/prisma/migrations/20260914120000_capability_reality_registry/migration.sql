-- CreateEnum
CREATE TYPE "CapabilityMaturity" AS ENUM ('DESIGNED', 'IMPLEMENTED', 'TESTED', 'INTEGRATED', 'DEPLOYED', 'VERIFIED', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "CapabilityHealth" AS ENUM ('HEALTHY', 'DEGRADED', 'BROKEN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CapabilityEvidenceKind" AS ENUM ('TEST', 'DEPLOYMENT', 'PRODUCTION_OBSERVATION', 'ADR');

-- CreateEnum
CREATE TYPE "GoldenRegressionStatus" AS ENUM ('PASSING', 'FAILING', 'NOT_WIRED');

-- CreateTable
CREATE TABLE "capability" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "maturity" "CapabilityMaturity" NOT NULL,
    "health" "CapabilityHealth" NOT NULL DEFAULT 'UNKNOWN',
    "ownerModule" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capability_evidence" (
    "id" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "kind" "CapabilityEvidenceKind" NOT NULL,
    "reference" TEXT NOT NULL,
    "note" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capability_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "golden_regression" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expectedResult" TEXT NOT NULL,
    "testReference" TEXT NOT NULL,
    "status" "GoldenRegressionStatus" NOT NULL DEFAULT 'NOT_WIRED',
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "golden_regression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "capability_key_key" ON "capability"("key");

-- CreateIndex
CREATE INDEX "capability_domain_idx" ON "capability"("domain");

-- CreateIndex
CREATE INDEX "capability_maturity_idx" ON "capability"("maturity");

-- CreateIndex
CREATE INDEX "capability_health_idx" ON "capability"("health");

-- CreateIndex
CREATE INDEX "capability_evidence_capabilityId_idx" ON "capability_evidence"("capabilityId");

-- CreateIndex
CREATE UNIQUE INDEX "golden_regression_key_key" ON "golden_regression"("key");

-- CreateIndex
CREATE INDEX "golden_regression_status_idx" ON "golden_regression"("status");

-- AddForeignKey
ALTER TABLE "capability_evidence" ADD CONSTRAINT "capability_evidence_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: initial Capability Reality Registry rows from Phase 0 reconciliation
-- (see SEMSE_EXECUTION_LEDGER.md and ADR-027..032). Maturity/health recorded
-- honestly per what Phase 0 actually found — several are DEGRADED because
-- the ADR decision exists but the code consolidation has not happened yet.

INSERT INTO "capability" ("id", "key", "domain", "description", "maturity", "health", "ownerModule", "updatedAt") VALUES
('cap_pricing_engine', 'pricing-engine', 'Finance/Payments', 'Canonical economic/pricing evaluator per ADR-027 (D03). Formulas not yet fully migrated from contractor-estimate.', 'INTEGRATED', 'DEGRADED', 'apps/api/src/modules/pricing', CURRENT_TIMESTAMP),
('cap_contractor_estimate', 'contractor-estimate', 'Finance/Payments', 'Contractor estimate orchestration. Per ADR-027 (D03) must stop maintaining independent economic calculations and consume pricing-engine.', 'INTEGRATED', 'DEGRADED', 'apps/api/src/modules/contractor', CURRENT_TIMESTAMP),
('cap_evidence_domain', 'evidence-domain', 'Evidence', 'Canonical Evidence lifecycle/registration/approval per ADR-028 (D04).', 'PRODUCTION', 'HEALTHY', 'apps/api/src/modules/evidence', CURRENT_TIMESTAMP),
('cap_evidence_gateway', 'evidence-gateway', 'Evidence', 'Evidence integration gateway. Per ADR-028 (D04) must become adapter-only; currently retains independent registry/lifecycle authority.', 'INTEGRATED', 'DEGRADED', 'apps/api/src/modules/evidence-gateway', CURRENT_TIMESTAMP),
('cap_labor_engine', 'labor-engine', 'Time/Labor', 'Canonical owner of time/labor commands per ADR-029 (D05).', 'PRODUCTION', 'HEALTHY', 'apps/api/src/modules/labor-engine', CURRENT_TIMESTAMP),
('cap_time_tracker', 'field-time-tracker', 'Time/Labor', 'Field time-tracker capture surface. Per ADR-029 (D05) must converge on labor-engine for start/pause/resume/stop/manual-entry. Area has a July 2026 production-incident history — no destructive replacement without a regression test first.', 'DEPLOYED', 'DEGRADED', 'apps/api/src/modules/field-ops', CURRENT_TIMESTAMP),
('cap_deploy_provenance', 'deploy-provenance', 'Reliability', 'Real git SHA / build-time provenance exposed via /v1/health per ADR-030 (D08). Reads RAILWAY_GIT_COMMIT_SHA with explicit "unknown" fallback.', 'VERIFIED', 'HEALTHY', 'apps/api/src/modules/health', CURRENT_TIMESTAMP),
('cap_conduit_offset_engine', 'conduit-offset-engine', 'Electrical/Field', 'Deterministic conduit-offset geometry engine per ADR-031: spacing = offset / sin(angle). Hard guard blocks exact arrow/star/tool-specific marking output for unverified benders; geometry stays available.', 'TESTED', 'HEALTHY', 'packages/tools/src/trades/electrical', CURRENT_TIMESTAMP),
('cap_capability_registry', 'capability-reality-registry', 'Reliability', 'This registry (Capability + CapabilityEvidence + GoldenRegression) per ADR-032. Migration merged to main; not yet applied to the production database as of authoring.', 'DEPLOYED', 'UNKNOWN', 'packages/db/prisma + apps/api/src/modules/capability-registry', CURRENT_TIMESTAMP);

INSERT INTO "capability_evidence" ("id", "capabilityId", "kind", "reference", "note") VALUES
('ev_pricing_engine_adr', 'cap_pricing_engine', 'ADR', 'docs/architecture/ADR-027-economic-evaluator-consolidation.md', NULL),
('ev_contractor_estimate_adr', 'cap_contractor_estimate', 'ADR', 'docs/architecture/ADR-027-economic-evaluator-consolidation.md', NULL),
('ev_evidence_domain_adr', 'cap_evidence_domain', 'ADR', 'docs/architecture/ADR-028-evidence-gateway-adapter-role.md', NULL),
('ev_evidence_gateway_adr', 'cap_evidence_gateway', 'ADR', 'docs/architecture/ADR-028-evidence-gateway-adapter-role.md', NULL),
('ev_labor_engine_adr', 'cap_labor_engine', 'ADR', 'docs/architecture/ADR-029-labor-engine-canonical-time-owner.md', NULL),
('ev_time_tracker_adr', 'cap_time_tracker', 'ADR', 'docs/architecture/ADR-029-labor-engine-canonical-time-owner.md', NULL),
('ev_deploy_provenance_adr', 'cap_deploy_provenance', 'ADR', 'docs/architecture/ADR-030-service-deploy-provenance.md', NULL),
('ev_deploy_provenance_prod', 'cap_deploy_provenance', 'PRODUCTION_OBSERVATION', 'https://api.semseproject.com/v1/health', 'Verified 2026-09-14: gitSha field returns a real commit SHA instead of the previously hardcoded "2026-05-18a".'),
('ev_conduit_offset_adr', 'cap_conduit_offset_engine', 'ADR', 'docs/architecture/ADR-031-conduit-offset-engine-v1.md', NULL),
('ev_conduit_offset_test', 'cap_conduit_offset_engine', 'TEST', 'packages/tools/test/conduit-offset.test.ts', 'Golden case 6in@30deg=12in and unverified-bender marking guard both covered.'),
('ev_capability_registry_adr', 'cap_capability_registry', 'ADR', 'docs/architecture/ADR-032-capability-reality-registry.md', NULL);

INSERT INTO "golden_regression" ("id", "key", "description", "expectedResult", "testReference", "status", "lastCheckedAt") VALUES
('gr_conduit_offset_6in_30deg', 'conduit-offset-6in-30deg', '6in offset at a 30-degree bend must yield 12in spacing (spacing = offset / sin(angle)).', 'spacingIn = 12', 'packages/tools/test/conduit-offset.test.ts', 'PASSING', CURRENT_TIMESTAMP),
('gr_payment_release_canonical', 'payment-release-canonical-path', 'All payment release paths (UI/agent/workflow) must converge on the single escrow-release command.', 'One canonical command path, no direct writes elsewhere', 'not yet wired to an automated regression', 'NOT_WIRED', NULL),
('gr_privacy_local_fallback', 'privacy-local-only-fallback', 'Cross-tenant / cross-actor requests must never leak another tenant''s data via a local/offline fallback path.', 'No cross-tenant data in response', 'not yet wired to an automated regression', 'NOT_WIRED', NULL),
('gr_migration_startup', 'migration-startup-safety', 'A failed migration must block subsequent deploys with a clear, resolvable error rather than silently skipping or corrupting state.', 'migrate deploy fails loudly, resolve path documented', 'not yet wired to an automated regression', 'NOT_WIRED', NULL),
('gr_cross_tenant_isolation', 'cross-tenant-isolation', 'No resource read/write may cross tenant boundaries regardless of actor role.', 'Cross-tenant access denied', 'not yet wired to an automated regression', 'NOT_WIRED', NULL),
('gr_duplicate_command', 'duplicate-command-rejection', 'The same idempotency key must not produce two distinct side effects.', 'Second call is a no-op returning the first result', 'not yet wired to an automated regression', 'NOT_WIRED', NULL),
('gr_duplicate_event', 'duplicate-event-dedupe', 'Re-delivered domain events must be deduped by consumers.', 'Second delivery has no additional side effect', 'not yet wired to an automated regression', 'NOT_WIRED', NULL),
('gr_stale_approval', 'stale-approval-rejection', 'An approval based on a stale expectedVersion must be rejected, not silently applied.', 'Stale approval returns a version-conflict error', 'not yet wired to an automated regression', 'NOT_WIRED', NULL),
('gr_offline_conflict', 'offline-conflict-resolution', 'Offline-queued writes that conflict with server state on reconnect must be surfaced, not silently overwritten.', 'Conflict surfaced to the actor, not auto-resolved', 'not yet wired to an automated regression', 'NOT_WIRED', NULL);
