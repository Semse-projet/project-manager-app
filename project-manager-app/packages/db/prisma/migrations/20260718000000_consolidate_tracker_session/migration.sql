-- Consolidate legacy field-ops time tracking into the Labor Engine canonical table.
-- TimeEntry becomes the single source of truth for time records; TrackerSession is removed.

-- 1. Add generic context fields to TimeEntry so it can link to FieldUnit, Job, Animal, etc.
ALTER TABLE "TimeEntry" ADD COLUMN "contextEntityType" TEXT;
ALTER TABLE "TimeEntry" ADD COLUMN "contextEntityId" TEXT;

CREATE INDEX "TimeEntry_tenantId_contextEntityType_contextEntityId_idx"
    ON "TimeEntry"("tenantId", "contextEntityType", "contextEntityId");

-- 2. Migrate legacy TrackerSession rows into TimeEntry.
--    All legacy sessions are job-linked field-ops tracker entries.
INSERT INTO "TimeEntry" (
    "id",
    "tenantId",
    "orgId",
    "createdBy",
    "mode",
    "purpose",
    "jobId",
    "freeProjectId",
    "status",
    "startedAt",
    "endedAt",
    "resumedAt",
    "pausedAt",
    "breakMinutes",
    "durationMinutes",
    "accumulatedSeconds",
    "hourlyRate",
    "currency",
    "location",
    "notes",
    "editedBy",
    "editReason",
    "contextEntityType",
    "contextEntityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    ts."tenantId",
    ts."orgId",
    ts."createdBy",
    CASE ts.status::text
        WHEN 'STOPPED' THEN 'manual'
        ELSE 'realtime'
    END,
    'job_linked',
    ts."jobId",
    NULL,
    CASE ts.status::text
        WHEN 'RUNNING' THEN 'running'
        WHEN 'PAUSED' THEN 'paused'
        WHEN 'STOPPED' THEN 'completed'
    END,
    ts."startedAt",
    CASE WHEN ts.status::text = 'STOPPED' THEN ts."stoppedAt" ELSE NULL END,
    ts."resumedAt",
    ts."pausedAt",
    0,
    CASE WHEN ts.status::text = 'STOPPED' THEN floor(ts."accumulatedSeconds" / 60) ELSE NULL END,
    ts."accumulatedSeconds",
    NULL,
    'MXN',
    NULL,
    ts.notes,
    NULL,
    NULL,
    'Job',
    ts."jobId",
    ts."createdAt",
    ts."updatedAt"
FROM "TrackerSession" ts;

-- 3. Remove the legacy TrackerSession table and its enum.
DROP TABLE "TrackerSession" CASCADE;
DROP TYPE "TrackerSessionStatus";
