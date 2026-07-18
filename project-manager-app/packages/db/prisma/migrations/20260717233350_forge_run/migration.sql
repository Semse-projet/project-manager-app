-- CreateTable
CREATE TABLE "ForgeRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'idea',
    "specId" TEXT NOT NULL,
    "specPath" TEXT NOT NULL,
    "specDigest" TEXT NOT NULL,
    "specStatus" TEXT NOT NULL,
    "tasksJson" JSONB NOT NULL DEFAULT '[]',
    "assignedAgentsJson" JSONB NOT NULL DEFAULT '{}',
    "approvalsJson" JSONB NOT NULL DEFAULT '[]',
    "eventsJson" JSONB NOT NULL DEFAULT '[]',
    "agentRunIdsJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForgeRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForgeRun_tenantId_state_createdAt_idx" ON "ForgeRun"("tenantId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "ForgeRun_tenantId_specId_idx" ON "ForgeRun"("tenantId", "specId");

-- AddForeignKey
ALTER TABLE "ForgeRun" ADD CONSTRAINT "ForgeRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
