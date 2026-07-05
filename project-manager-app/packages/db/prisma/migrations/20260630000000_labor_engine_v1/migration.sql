-- Labor Engine v1: FreeProject, TimeEntry, TimeEvidence, LaborSheet

-- FreeProject: lightweight project without formal SEMSE job/contract
CREATE TABLE "FreeProject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "location" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "convertedJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FreeProject_pkey" PRIMARY KEY ("id")
);

-- TimeEntry: central time record (realtime or manual)
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'manual',
    "purpose" TEXT NOT NULL DEFAULT 'personal',
    "jobId" TEXT,
    "freeProjectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "resumedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER,
    "accumulatedSeconds" INTEGER NOT NULL DEFAULT 0,
    "hourlyRate" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "location" TEXT,
    "notes" TEXT,
    "editedBy" TEXT,
    "editReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- TimeEvidence: evidence attached to a TimeEntry
CREATE TABLE "TimeEvidence" (
    "id" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT,
    "description" TEXT,
    "timestamp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeEvidence_pkey" PRIMARY KEY ("id")
);

-- LaborSheet: aggregated weekly/period summary per worker
CREATE TABLE "LaborSheet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LaborSheet_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "FreeProject" ADD CONSTRAINT "FreeProject_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_freeProjectId_fkey"
    FOREIGN KEY ("freeProjectId") REFERENCES "FreeProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TimeEvidence" ADD CONSTRAINT "TimeEvidence_timeEntryId_fkey"
    FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LaborSheet" ADD CONSTRAINT "LaborSheet_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "FreeProject_tenantId_createdBy_status_idx" ON "FreeProject"("tenantId", "createdBy", "status");
CREATE INDEX "FreeProject_tenantId_status_idx" ON "FreeProject"("tenantId", "status");

CREATE INDEX "TimeEntry_tenantId_createdBy_status_idx" ON "TimeEntry"("tenantId", "createdBy", "status");
CREATE INDEX "TimeEntry_tenantId_jobId_idx" ON "TimeEntry"("tenantId", "jobId");
CREATE INDEX "TimeEntry_tenantId_freeProjectId_idx" ON "TimeEntry"("tenantId", "freeProjectId");
CREATE INDEX "TimeEntry_tenantId_startedAt_idx" ON "TimeEntry"("tenantId", "startedAt");
CREATE INDEX "TimeEntry_tenantId_createdBy_startedAt_idx" ON "TimeEntry"("tenantId", "createdBy", "startedAt");

CREATE INDEX "TimeEvidence_timeEntryId_idx" ON "TimeEvidence"("timeEntryId");

CREATE UNIQUE INDEX "LaborSheet_tenantId_workerId_periodStart_periodEnd_key"
    ON "LaborSheet"("tenantId", "workerId", "periodStart", "periodEnd");
CREATE INDEX "LaborSheet_tenantId_workerId_status_idx" ON "LaborSheet"("tenantId", "workerId", "status");
CREATE INDEX "LaborSheet_tenantId_periodStart_idx" ON "LaborSheet"("tenantId", "periodStart");
