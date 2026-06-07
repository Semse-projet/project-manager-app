CREATE TABLE "BuildOpsPlanVersion" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "buildOpsProjectId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "sourceToolInputJson" JSONB,
  "sourceToolResultJson" JSONB,
  "inputSnapshotJson" JSONB,
  "clientPlanReviewCommentSnapshot" TEXT,
  "runReason" TEXT NOT NULL,
  "triggeredByUserId" TEXT NOT NULL,
  "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "previousVersionId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'running',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BuildOpsPlanVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BuildOpsPlanVersion_buildOpsProjectId_versionNumber_key"
  ON "BuildOpsPlanVersion"("buildOpsProjectId", "versionNumber");

CREATE INDEX "BuildOpsPlanVersion_tenantId_buildOpsProjectId_status_idx"
  ON "BuildOpsPlanVersion"("tenantId", "buildOpsProjectId", "status");

CREATE INDEX "BuildOpsPlanVersion_buildOpsProjectId_previousVersionId_idx"
  ON "BuildOpsPlanVersion"("buildOpsProjectId", "previousVersionId");

CREATE UNIQUE INDEX "BuildOpsPlanVersion_active_unique"
  ON "BuildOpsPlanVersion"("buildOpsProjectId")
  WHERE "status" = 'active';

CREATE UNIQUE INDEX "BuildOpsPlanVersion_running_unique"
  ON "BuildOpsPlanVersion"("buildOpsProjectId")
  WHERE "status" = 'running';

ALTER TABLE "BuildOpsPlanVersion"
  ADD CONSTRAINT "BuildOpsPlanVersion_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BuildOpsPlanVersion"
  ADD CONSTRAINT "BuildOpsPlanVersion_buildOpsProjectId_fkey"
  FOREIGN KEY ("buildOpsProjectId") REFERENCES "BuildOpsProject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BuildOpsPlanVersion"
  ADD CONSTRAINT "BuildOpsPlanVersion_previousVersionId_fkey"
  FOREIGN KEY ("previousVersionId") REFERENCES "BuildOpsPlanVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
