-- Fase 1: extiende JobTask para que actúe como la entidad canónica Task.
-- BuildOpsTask y AgroFarmTask permanecen; sus datos se migrarán en fases posteriores.

-- Permitir tareas sin jobId (BuildOps/Agro aún no vinculadas a un job)
ALTER TABLE "JobTask" ALTER COLUMN "jobId" DROP NOT NULL;
ALTER TABLE "JobTask" ALTER COLUMN "milestone" DROP NOT NULL;

-- BuildOps-specific columns
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "orgId" TEXT;
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "templateKey" TEXT;
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "sourceTool" TEXT;
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "completion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "evidenceRequired" JSONB;
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "assigneeName" TEXT;

-- Agro-specific columns
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "farmId" TEXT;
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "targetType" TEXT;
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "targetId" TEXT;
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "taskType" TEXT;
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMP(3);
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP(3);
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "blockReason" TEXT;
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Polymorphic context for future verticals
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "domain" TEXT NOT NULL DEFAULT 'jobs';
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "vertical" TEXT;
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "entityType" TEXT;
ALTER TABLE "JobTask" ADD COLUMN IF NOT EXISTS "entityId" TEXT;

-- Indexes for the new canonical shape
CREATE INDEX IF NOT EXISTS "JobTask_tenantId_domain_status_idx" ON "JobTask"("tenantId", "domain", "status");
CREATE INDEX IF NOT EXISTS "JobTask_tenantId_projectId_idx" ON "JobTask"("tenantId", "projectId");
CREATE INDEX IF NOT EXISTS "JobTask_tenantId_farmId_idx" ON "JobTask"("tenantId", "farmId");
CREATE INDEX IF NOT EXISTS "JobTask_tenantId_entityType_entityId_idx" ON "JobTask"("tenantId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "JobTask_tenantId_targetType_targetId_idx" ON "JobTask"("tenantId", "targetType", "targetId");
