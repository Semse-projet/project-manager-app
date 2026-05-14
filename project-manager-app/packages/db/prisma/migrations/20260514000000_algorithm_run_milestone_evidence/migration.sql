-- Migration: AlgorithmRun + Milestone evidence/approval/payment readiness fields
-- Date: 2026-05-14

-- ── AlgorithmRun — stores each ProTools calculation for auditing and learning ──
CREATE TABLE "AlgorithmRun" (
    "id"                  TEXT NOT NULL,
    "tenantId"            TEXT,
    "userId"              TEXT,
    "jobId"               TEXT,
    "buildOpsProjectId"   TEXT,
    "trade"               TEXT NOT NULL,
    "toolName"            TEXT NOT NULL,
    "algorithmVersion"    TEXT NOT NULL DEFAULT 'unknown-v1.0.0',
    "inputJson"           JSONB NOT NULL DEFAULT '{}',
    "outputJson"          JSONB NOT NULL DEFAULT '{}',
    "confidenceScore"     INTEGER,
    "riskScore"           INTEGER,
    "readinessScore"      INTEGER,
    "disputeRiskScore"    INTEGER,
    "priceBandLow"        DECIMAL(12,2),
    "priceBandMid"        DECIMAL(12,2),
    "priceBandHigh"       DECIMAL(12,2),
    "canPublish"          BOOLEAN NOT NULL DEFAULT true,
    "canCreateBuildOps"   BOOLEAN NOT NULL DEFAULT false,
    "canCreateContract"   BOOLEAN NOT NULL DEFAULT false,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlgorithmRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AlgorithmRun_trade_idx"              ON "AlgorithmRun"("trade");
CREATE INDEX "AlgorithmRun_userId_idx"             ON "AlgorithmRun"("userId");
CREATE INDEX "AlgorithmRun_jobId_idx"              ON "AlgorithmRun"("jobId");
CREATE INDEX "AlgorithmRun_buildOpsProjectId_idx"  ON "AlgorithmRun"("buildOpsProjectId");
CREATE INDEX "AlgorithmRun_createdAt_idx"          ON "AlgorithmRun"("createdAt");

-- ── MilestoneEvidenceItem — tracks required evidence per milestone ──────────────
-- Each milestone can have specific evidence requirements (photo, video, document)
-- and tracks whether each item was submitted and approved.
CREATE TABLE "MilestoneEvidenceItem" (
    "id"            TEXT NOT NULL,
    "milestoneId"   TEXT NOT NULL,
    "label"         TEXT NOT NULL,
    "description"   TEXT,
    "kind"          TEXT NOT NULL DEFAULT 'PHOTO',      -- PHOTO | VIDEO | DOCUMENT
    "phase"         TEXT NOT NULL DEFAULT 'after',      -- before | during | after
    "required"      BOOLEAN NOT NULL DEFAULT true,
    "status"        TEXT NOT NULL DEFAULT 'missing',    -- missing | submitted | approved | rejected
    "evidenceId"    TEXT,                               -- FK to Evidence when submitted
    "reviewNote"    TEXT,
    "reviewedById"  TEXT,
    "reviewedAt"    TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneEvidenceItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MilestoneEvidenceItem_milestoneId_fkey"
        FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE
);

CREATE INDEX "MilestoneEvidenceItem_milestoneId_idx"  ON "MilestoneEvidenceItem"("milestoneId");
CREATE INDEX "MilestoneEvidenceItem_status_idx"       ON "MilestoneEvidenceItem"("status");

-- ── Add payment readiness to Milestone ────────────────────────────────────────
-- evidenceReadiness: computed from MilestoneEvidenceItem statuses
-- paymentReadiness:  not_ready | ready_to_release | released | held
ALTER TABLE "Milestone"
    ADD COLUMN IF NOT EXISTS "paymentReadiness"    TEXT NOT NULL DEFAULT 'not_ready',
    ADD COLUMN IF NOT EXISTS "evidenceReadiness"   TEXT NOT NULL DEFAULT 'missing',
    ADD COLUMN IF NOT EXISTS "clientNote"          TEXT,
    ADD COLUMN IF NOT EXISTS "clientReviewedAt"    TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "clientReviewedById"  TEXT;

-- Index for payment-ready milestones
CREATE INDEX "Milestone_paymentReadiness_idx" ON "Milestone"("paymentReadiness");
