-- BO-08 labor-policy: tablas aditivas, sin backfill ni DML. No toca TimeEntry.
CREATE TABLE "LaborSchedulePolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "worksiteId" TEXT,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "weekdays" INTEGER[],
    "scheduledStartMinute" INTEGER NOT NULL,
    "scheduledEndMinute" INTEGER NOT NULL,
    "expectedBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeAfterMinutesPerDay" INTEGER,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "LaborSchedulePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LaborTimeCorrection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "originalStartedAt" TIMESTAMP(3) NOT NULL,
    "originalEndedAt" TIMESTAMP(3),
    "originalBreakMinutes" INTEGER NOT NULL,
    "proposedStartedAt" TIMESTAMP(3) NOT NULL,
    "proposedEndedAt" TIMESTAMP(3),
    "proposedBreakMinutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaborTimeCorrection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LaborSchedulePolicy_tenantId_orgId_scopeKey_version_key" ON "LaborSchedulePolicy"("tenantId", "orgId", "scopeKey", "version");
CREATE INDEX "LaborSchedulePolicy_tenantId_orgId_scopeKey_status_idx" ON "LaborSchedulePolicy"("tenantId", "orgId", "scopeKey", "status");
CREATE INDEX "LaborTimeCorrection_tenantId_orgId_status_createdAt_idx" ON "LaborTimeCorrection"("tenantId", "orgId", "status", "createdAt");
CREATE INDEX "LaborTimeCorrection_timeEntryId_status_idx" ON "LaborTimeCorrection"("timeEntryId", "status");
CREATE INDEX "LaborTimeCorrection_requestedByUserId_idx" ON "LaborTimeCorrection"("requestedByUserId");
