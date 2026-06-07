-- AlterTable
ALTER TABLE "BuildOpsProject" ADD COLUMN "jobId" TEXT;

-- AlterTable
ALTER TABLE "BuildOpsTask" ADD COLUMN "templateKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BuildOpsProject_jobId_key" ON "BuildOpsProject"("jobId");

-- CreateIndex
CREATE INDEX "BuildOpsProject_tenantId_jobId_idx" ON "BuildOpsProject"("tenantId", "jobId");

-- CreateIndex
CREATE INDEX "BuildOpsTask_tenantId_templateKey_idx" ON "BuildOpsTask"("tenantId", "templateKey");

-- CreateIndex
CREATE UNIQUE INDEX "BuildOpsTask_projectId_templateKey_key" ON "BuildOpsTask"("projectId", "templateKey");

-- AddForeignKey
ALTER TABLE "BuildOpsProject"
ADD CONSTRAINT "BuildOpsProject_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "Job"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
