-- BO-11 daily-reports: tabla aditiva, sin backfill ni DML. No toca TimeEntry ni JobTask.
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "worksiteId" TEXT,
    "reportDate" TEXT NOT NULL,
    "tzOffsetMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "snapshot" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "notes" TEXT,
    "generatedByUserId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyReport_crewId_reportDate_key" ON "DailyReport"("crewId", "reportDate");
CREATE INDEX "DailyReport_tenantId_orgId_status_reportDate_idx" ON "DailyReport"("tenantId", "orgId", "status", "reportDate");
