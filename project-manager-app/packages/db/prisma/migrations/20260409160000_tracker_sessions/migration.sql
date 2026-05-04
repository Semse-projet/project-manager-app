DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'TrackerSessionStatus'
  ) THEN
    CREATE TYPE "TrackerSessionStatus" AS ENUM ('RUNNING', 'PAUSED', 'STOPPED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "TrackerSession" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "status" "TrackerSessionStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "resumedAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "stoppedAt" TIMESTAMP(3),
  "accumulatedSeconds" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrackerSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrackerSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TrackerSession_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TrackerSession_tenantId_createdBy_status_idx"
  ON "TrackerSession"("tenantId", "createdBy", "status");
CREATE INDEX IF NOT EXISTS "TrackerSession_tenantId_jobId_status_idx"
  ON "TrackerSession"("tenantId", "jobId", "status");
CREATE INDEX IF NOT EXISTS "TrackerSession_tenantId_startedAt_idx"
  ON "TrackerSession"("tenantId", "startedAt");
