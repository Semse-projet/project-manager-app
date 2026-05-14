-- Migration: ChangeOrderCandidate
-- Date: 2026-05-14
-- Tracks change orders from engine predictions to client approval

CREATE TABLE "ChangeOrderCandidate" (
    "id"               TEXT NOT NULL,
    "tenantId"         TEXT NOT NULL,
    "buildOpsProjectId" TEXT,
    "jobId"            TEXT,
    "milestoneId"      TEXT,
    "algorithmRunId"   TEXT,
    "title"            TEXT NOT NULL,
    "description"      TEXT,
    "trigger"          TEXT NOT NULL,   -- what triggered this CO
    "pricingMode"      TEXT NOT NULL DEFAULT 'time_and_materials',
    "estimatedMin"     DECIMAL(12,2),
    "estimatedMax"     DECIMAL(12,2),
    "status"           TEXT NOT NULL DEFAULT 'predicted', -- predicted | submitted | approved | rejected | voided
    "submittedById"    TEXT,
    "submittedAt"      TIMESTAMP(3),
    "reviewedById"     TEXT,
    "reviewedAt"       TIMESTAMP(3),
    "clientNote"       TEXT,
    "probability"      INTEGER,         -- 0-100 from engine prediction
    "evidenceJson"     JSONB,           -- evidence URLs/IDs attached
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeOrderCandidate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChangeOrderCandidate_tenantId_idx"         ON "ChangeOrderCandidate"("tenantId");
CREATE INDEX "ChangeOrderCandidate_buildOpsProjectId_idx" ON "ChangeOrderCandidate"("buildOpsProjectId");
CREATE INDEX "ChangeOrderCandidate_jobId_idx"            ON "ChangeOrderCandidate"("jobId");
CREATE INDEX "ChangeOrderCandidate_status_idx"           ON "ChangeOrderCandidate"("status");
CREATE INDEX "ChangeOrderCandidate_createdAt_idx"        ON "ChangeOrderCandidate"("createdAt");
