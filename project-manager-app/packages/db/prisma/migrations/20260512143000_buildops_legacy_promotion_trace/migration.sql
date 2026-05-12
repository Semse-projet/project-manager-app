ALTER TABLE "Project"
  ADD COLUMN "promotedFromBuildOpsProjectId" TEXT,
  ADD COLUMN "promotedAt" TIMESTAMP(3),
  ADD COLUMN "promotedByUserId" TEXT;

ALTER TABLE "Milestone"
  ADD COLUMN "promotedFromBuildOpsProjectId" TEXT,
  ADD COLUMN "promotedAt" TIMESTAMP(3),
  ADD COLUMN "promotedByUserId" TEXT;

ALTER TABLE "Evidence"
  ADD COLUMN "promotedFromBuildOpsProjectId" TEXT,
  ADD COLUMN "promotedAt" TIMESTAMP(3),
  ADD COLUMN "promotedByUserId" TEXT;

ALTER TABLE "JobTask"
  ADD COLUMN "promotedFromBuildOpsProjectId" TEXT,
  ADD COLUMN "promotedFromBuildOpsTaskId" TEXT,
  ADD COLUMN "promotedAt" TIMESTAMP(3),
  ADD COLUMN "promotedByUserId" TEXT;

CREATE UNIQUE INDEX "Project_promotedFromBuildOpsProjectId_key"
  ON "Project"("promotedFromBuildOpsProjectId");

CREATE INDEX "Project_tenantId_promotedFromBuildOpsProjectId_idx"
  ON "Project"("tenantId", "promotedFromBuildOpsProjectId");

CREATE INDEX "Milestone_projectId_promotedFromBuildOpsProjectId_idx"
  ON "Milestone"("projectId", "promotedFromBuildOpsProjectId");

CREATE UNIQUE INDEX "Milestone_projectId_promotedFromBuildOpsProjectId_sequence_key"
  ON "Milestone"("projectId", "promotedFromBuildOpsProjectId", "sequence");

CREATE INDEX "Evidence_projectId_promotedFromBuildOpsProjectId_idx"
  ON "Evidence"("projectId", "promotedFromBuildOpsProjectId");

CREATE UNIQUE INDEX "Evidence_projectId_promotedFromBuildOpsProjectId_bucketKey_key"
  ON "Evidence"("projectId", "promotedFromBuildOpsProjectId", "bucketKey");

CREATE INDEX "JobTask_tenantId_promotedFromBuildOpsProjectId_idx"
  ON "JobTask"("tenantId", "promotedFromBuildOpsProjectId");

CREATE UNIQUE INDEX "JobTask_jobId_promotedFromBuildOpsTaskId_key"
  ON "JobTask"("jobId", "promotedFromBuildOpsTaskId");
