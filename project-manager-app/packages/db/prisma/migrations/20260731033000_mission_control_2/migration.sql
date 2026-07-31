-- Mission Control 2.0 F4
-- Additive only: existing AI incidents remain valid and no data is backfilled
-- destructively. Rollback is performed with feature flags; schema is retained.

CREATE TYPE "MissionControlActionReceiptStatus" AS ENUM (
  'REQUESTED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'NO_OP'
);

ALTER TABLE "MissionControlIncident"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'ai',
  ADD COLUMN "orgId" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "actorUserId" TEXT,
  ADD COLUMN "targetType" TEXT,
  ADD COLUMN "targetId" TEXT,
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "runbookId" TEXT,
  ADD COLUMN "actionReceiptId" TEXT,
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "MissionControlActionReceipt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'tenant',
  "reason" TEXT NOT NULL,
  "runbookId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "intentHash" TEXT NOT NULL,
  "status" "MissionControlActionReceiptStatus" NOT NULL DEFAULT 'REQUESTED',
  "dryRun" BOOLEAN NOT NULL DEFAULT false,
  "optionsJson" JSONB,
  "beforeJson" JSONB,
  "resultJson" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "requestId" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "incidentId" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "MissionControlActionReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MissionControlActionReceipt_tenantId_idempotencyKey_key"
  ON "MissionControlActionReceipt"("tenantId", "idempotencyKey");

CREATE INDEX "MissionControlActionReceipt_tenantId_status_createdAt_idx"
  ON "MissionControlActionReceipt"("tenantId", "status", "createdAt");

CREATE INDEX "MissionControlActionReceipt_targetType_targetId_idx"
  ON "MissionControlActionReceipt"("targetType", "targetId");

CREATE INDEX "MissionControlActionReceipt_correlationId_idx"
  ON "MissionControlActionReceipt"("correlationId");

CREATE INDEX "MissionControlIncident_tenantId_status_createdAt_idx"
  ON "MissionControlIncident"("tenantId", "status", "createdAt");

CREATE INDEX "MissionControlIncident_targetType_targetId_idx"
  ON "MissionControlIncident"("targetType", "targetId");
