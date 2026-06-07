CREATE TABLE "JobTask" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "milestone" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assignedTo" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "JobTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "JobTask_tenantId_jobId_status_idx" ON "JobTask"("tenantId", "jobId", "status");
CREATE INDEX "JobTask_tenantId_assignedTo_status_idx" ON "JobTask"("tenantId", "assignedTo", "status");
CREATE INDEX "JobTask_tenantId_deletedAt_idx" ON "JobTask"("tenantId", "deletedAt");
ALTER TABLE "JobTask" ADD CONSTRAINT "JobTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "JobIncident" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "reportedBy" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobIncident_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "JobIncident_tenantId_jobId_status_idx" ON "JobIncident"("tenantId", "jobId", "status");
CREATE INDEX "JobIncident_tenantId_reportedBy_idx" ON "JobIncident"("tenantId", "reportedBy");
CREATE INDEX "JobIncident_tenantId_severity_status_idx" ON "JobIncident"("tenantId", "severity", "status");
ALTER TABLE "JobIncident" ADD CONSTRAINT "JobIncident_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MaterialRequest" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "milestone" TEXT,
    "item" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unidades',
    "estimatedCost" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaterialRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaterialRequest_tenantId_jobId_status_idx" ON "MaterialRequest"("tenantId", "jobId", "status");
CREATE INDEX "MaterialRequest_tenantId_requestedBy_status_idx" ON "MaterialRequest"("tenantId", "requestedBy", "status");
CREATE INDEX "MaterialRequest_tenantId_status_idx" ON "MaterialRequest"("tenantId", "status");
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
