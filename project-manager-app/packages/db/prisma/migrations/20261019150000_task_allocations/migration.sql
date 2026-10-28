-- BO-10 task-allocations: tabla aditiva, sin backfill ni DML. No toca JobTask.
CREATE TABLE "TaskAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "assignedByUserId" TEXT NOT NULL,
    "assignReason" TEXT,
    "statusNote" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "releasedByUserId" TEXT,
    "releaseReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskAllocation_taskId_userId_key" ON "TaskAllocation"("taskId", "userId");
CREATE INDEX "TaskAllocation_tenantId_orgId_crewId_status_idx" ON "TaskAllocation"("tenantId", "orgId", "crewId", "status");
CREATE INDEX "TaskAllocation_userId_status_idx" ON "TaskAllocation"("userId", "status");
