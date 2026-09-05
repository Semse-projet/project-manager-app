CREATE TABLE "ProjectLifecycleProjection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "revision" TEXT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectLifecycleProjection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectLifecycleProjection_projectId_key"
    ON "ProjectLifecycleProjection"("projectId");
CREATE INDEX "ProjectLifecycleProjection_tenantId_updatedAt_idx"
    ON "ProjectLifecycleProjection"("tenantId", "updatedAt");
CREATE INDEX "ProjectLifecycleProjection_projectId_revision_idx"
    ON "ProjectLifecycleProjection"("projectId", "revision");

ALTER TABLE "ProjectLifecycleProjection"
    ADD CONSTRAINT "ProjectLifecycleProjection_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectLifecycleProjection"
    ADD CONSTRAINT "ProjectLifecycleProjection_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
