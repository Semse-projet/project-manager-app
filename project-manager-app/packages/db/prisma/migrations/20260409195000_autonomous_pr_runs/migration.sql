CREATE TABLE "AutonomousPrRun" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "task" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "repoPath" TEXT NOT NULL,
  "baseBranch" TEXT NOT NULL,
  "branchName" TEXT,
  "commitSha" TEXT,
  "generatedFile" TEXT,
  "prUrl" TEXT,
  "prState" TEXT,
  "error" TEXT,
  "logsJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AutonomousPrRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutonomousPrRun_tenantId_createdAt_idx" ON "AutonomousPrRun"("tenantId", "createdAt");
CREATE INDEX "AutonomousPrRun_tenantId_status_createdAt_idx" ON "AutonomousPrRun"("tenantId", "status", "createdAt");

ALTER TABLE "AutonomousPrRun"
ADD CONSTRAINT "AutonomousPrRun_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
