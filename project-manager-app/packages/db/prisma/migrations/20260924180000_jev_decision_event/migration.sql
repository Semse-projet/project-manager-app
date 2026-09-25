-- Jev Decision Layer telemetry (spec: docs/specs/prometeo/jev-decision-layer.spec.md §6)
-- Rollback: DROP TABLE "JevDecisionEvent";

-- CreateTable
CREATE TABLE "JevDecisionEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "feature" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "fallbackReason" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "model" TEXT,
    "finalSystemAction" TEXT NOT NULL,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JevDecisionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JevDecisionEvent_tenantId_feature_createdAt_idx" ON "JevDecisionEvent"("tenantId", "feature", "createdAt");

-- CreateIndex
CREATE INDEX "JevDecisionEvent_feature_source_createdAt_idx" ON "JevDecisionEvent"("feature", "source", "createdAt");

