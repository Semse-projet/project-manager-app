-- OPEN-18 — ubicación verificable de obra y vínculo Job/proyecto libre.
-- Spec: docs/specs/core/worksite-location-binding.spec.md (aprobada por el propietario el 2026-11-20).
-- Aditiva y nulable: no reescribe filas existentes ni toca "TimeEntry". Sin backfill.
-- Rollback de esquema (solo si se pide, tras exportar los datos): ver §10 de la spec.

-- AlterTable
ALTER TABLE "GeofenceEvent" ADD COLUMN     "bindingId" TEXT,
ADD COLUMN     "consumedByTimeEntryId" TEXT;

-- AlterTable
ALTER TABLE "Worksite" ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "locationSource" TEXT,
ADD COLUMN     "locationVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "locationVerifiedBy" TEXT,
ADD COLUMN     "longitude" DECIMAL(10,7),
ADD COLUMN     "radiusMeters" INTEGER;

-- CreateTable
CREATE TABLE "WorksiteBinding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "worksiteId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "jobId" TEXT,
    "freeProjectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "activeTargetKey" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedBy" TEXT,

    CONSTRAINT "WorksiteBinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorksiteBinding_activeTargetKey_key" ON "WorksiteBinding"("activeTargetKey");

-- CreateIndex
CREATE INDEX "WorksiteBinding_tenantId_worksiteId_status_idx" ON "WorksiteBinding"("tenantId", "worksiteId", "status");

-- CreateIndex
CREATE INDEX "WorksiteBinding_tenantId_jobId_idx" ON "WorksiteBinding"("tenantId", "jobId");

-- CreateIndex
CREATE INDEX "WorksiteBinding_tenantId_freeProjectId_idx" ON "WorksiteBinding"("tenantId", "freeProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "GeofenceEvent_consumedByTimeEntryId_key" ON "GeofenceEvent"("consumedByTimeEntryId");

-- AddForeignKey
ALTER TABLE "WorksiteBinding" ADD CONSTRAINT "WorksiteBinding_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorksiteBinding" ADD CONSTRAINT "WorksiteBinding_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorksiteBinding" ADD CONSTRAINT "WorksiteBinding_freeProjectId_fkey" FOREIGN KEY ("freeProjectId") REFERENCES "FreeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integridad que Prisma no expresa (Prisma no gestiona ni elimina CHECK constraints).
-- Exactamente un objetivo, coherente con "kind".
ALTER TABLE "WorksiteBinding" ADD CONSTRAINT "WorksiteBinding_target_ck" CHECK (
  ("kind" = 'JOB' AND "jobId" IS NOT NULL AND "freeProjectId" IS NULL) OR
  ("kind" = 'FREE_PROJECT' AND "freeProjectId" IS NOT NULL AND "jobId" IS NULL)
);
-- "activeTargetKey" existe solo mientras el vínculo está ACTIVE (unicidad del vínculo activo por objetivo).
ALTER TABLE "WorksiteBinding" ADD CONSTRAINT "WorksiteBinding_active_key_ck" CHECK (
  ("status" = 'ACTIVE' AND "activeTargetKey" IS NOT NULL) OR
  ("status" = 'ENDED' AND "activeTargetKey" IS NULL)
);
-- Radio de la geocerca de la obra: 50–1000 m cuando existe.
ALTER TABLE "Worksite" ADD CONSTRAINT "Worksite_radiusMeters_ck" CHECK (
  "radiusMeters" IS NULL OR ("radiusMeters" BETWEEN 50 AND 1000)
);
