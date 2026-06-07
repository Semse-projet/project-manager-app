ALTER TABLE "AgentRun"
ADD COLUMN "workerId" TEXT,
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "deadLettered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "error" TEXT,
ADD COLUMN "heartbeatAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "AgentRun"
SET "updatedAt" = "createdAt"
WHERE "updatedAt" IS NULL;

CREATE INDEX "AgentRun_tenantId_agentType_status_createdAt_idx"
ON "AgentRun"("tenantId", "agentType", "status", "createdAt");
