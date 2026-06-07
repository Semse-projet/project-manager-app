-- CreateTable
CREATE TABLE "AgentWorkPlan" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "orgId"       TEXT NOT NULL,
    "projectId"   TEXT,
    "createdBy"   TEXT NOT NULL,
    "agentId"     TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "status"      TEXT NOT NULL DEFAULT 'draft',
    "stepsJson"   JSONB NOT NULL,
    "contextJson" JSONB,
    "threadId"    TEXT,
    "approvedAt"  TIMESTAMP(3),
    "approvedBy"  TEXT,
    "rejectedAt"  TIMESTAMP(3),
    "rejectedBy"  TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentWorkPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentWorkPlan_tenantId_projectId_status_idx" ON "AgentWorkPlan"("tenantId", "projectId", "status");
CREATE INDEX "AgentWorkPlan_tenantId_createdAt_idx"         ON "AgentWorkPlan"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "AgentWorkPlan" ADD CONSTRAINT "AgentWorkPlan_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
