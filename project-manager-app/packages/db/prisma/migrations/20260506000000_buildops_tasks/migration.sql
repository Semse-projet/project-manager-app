-- CreateTable
CREATE TABLE "BuildOpsTask" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "projectId" TEXT,
  "createdBy" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'todo',
  "priority" TEXT NOT NULL DEFAULT 'medium',
  "assigneeName" TEXT,
  "assigneeUserId" TEXT,
  "dueDate" TIMESTAMP(3),
  "completion" INTEGER NOT NULL DEFAULT 0,
  "sourceTool" TEXT,
  "evidenceRequired" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BuildOpsTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuildOpsTask_tenantId_status_idx" ON "BuildOpsTask"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BuildOpsTask_tenantId_dueDate_idx" ON "BuildOpsTask"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "BuildOpsTask_tenantId_projectId_idx" ON "BuildOpsTask"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "BuildOpsTask_tenantId_priority_idx" ON "BuildOpsTask"("tenantId", "priority");

-- AddForeignKey
ALTER TABLE "BuildOpsTask"
ADD CONSTRAINT "BuildOpsTask_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildOpsTask"
ADD CONSTRAINT "BuildOpsTask_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Org"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildOpsTask"
ADD CONSTRAINT "BuildOpsTask_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "BuildOpsProject"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
