CREATE TABLE "JobsBidsProjection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "clientOrgId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "revision" TEXT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobsBidsProjection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobsBidsProjection_jobId_key"
    ON "JobsBidsProjection"("jobId");
CREATE INDEX "JobsBidsProjection_tenantId_updatedAt_idx"
    ON "JobsBidsProjection"("tenantId", "updatedAt");
CREATE INDEX "JobsBidsProjection_tenantId_clientOrgId_updatedAt_idx"
    ON "JobsBidsProjection"("tenantId", "clientOrgId", "updatedAt");
CREATE INDEX "JobsBidsProjection_jobId_revision_idx"
    ON "JobsBidsProjection"("jobId", "revision");

ALTER TABLE "JobsBidsProjection"
    ADD CONSTRAINT "JobsBidsProjection_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobsBidsProjection"
    ADD CONSTRAINT "JobsBidsProjection_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
