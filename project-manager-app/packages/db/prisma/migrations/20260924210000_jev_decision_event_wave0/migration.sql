-- Jev Decision Layer Wave 0 telemetry columns (spec: docs/specs/prometeo/jev-decision-layer.spec.md §9.4)
-- Additive only; rollback: ALTER TABLE "JevDecisionEvent" DROP COLUMN <each column below>;

-- AlterTable
ALTER TABLE "JevDecisionEvent" ADD COLUMN     "agreement" BOOLEAN,
ADD COLUMN     "canary" TEXT,
ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "costUsd" DOUBLE PRECISION,
ADD COLUMN     "deterministicDecision" TEXT,
ADD COLUMN     "inputClass" TEXT,
ADD COLUMN     "invariantsViolated" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "jevConfidence" DOUBLE PRECISION,
ADD COLUMN     "jevDecision" TEXT,
ADD COLUMN     "jevReasonCode" TEXT,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'shadow',
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'jev';

-- CreateIndex
CREATE INDEX "JevDecisionEvent_feature_mode_agreement_idx" ON "JevDecisionEvent"("feature", "mode", "agreement");

-- CreateIndex
CREATE INDEX "JevDecisionEvent_correlationId_idx" ON "JevDecisionEvent"("correlationId");

