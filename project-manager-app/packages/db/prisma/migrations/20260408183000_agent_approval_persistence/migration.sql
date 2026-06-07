DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'AgentApprovalStatus'
  ) THEN
    CREATE TYPE "AgentApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AgentApproval" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "agentType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "AgentApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "riskLevel" TEXT NOT NULL,
  "riskScore" DECIMAL(5,4) NOT NULL,
  "policyDecision" TEXT NOT NULL,
  "requiredApprovals" JSONB NOT NULL,
  "contextSummary" TEXT,
  "decisionComment" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decidedByUserId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentApproval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AgentApproval_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AgentApproval_tenantId_status_requestedAt_idx"
  ON "AgentApproval"("tenantId", "status", "requestedAt");
CREATE INDEX IF NOT EXISTS "AgentApproval_tenantId_runId_idx"
  ON "AgentApproval"("tenantId", "runId");
CREATE INDEX IF NOT EXISTS "AgentApproval_tenantId_correlationId_idx"
  ON "AgentApproval"("tenantId", "correlationId");
