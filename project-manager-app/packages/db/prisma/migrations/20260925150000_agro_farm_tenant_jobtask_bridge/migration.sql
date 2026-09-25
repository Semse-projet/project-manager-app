-- T-051: tenant de la finca + espejo AgroFarmTask → JobTask(domain="agro").
-- Spec: docs/specs/agro/agro-task-jobtask-convergence.spec.md
-- Aditiva: dos columnas opcionales, índices y FKs ON DELETE SET NULL. El
-- backfill es idempotente (ids deterministas, ON CONFLICT DO NOTHING) y no
-- modifica ni borra filas existentes salvo rellenar las columnas nuevas.

-- AlterTable
ALTER TABLE "AgroFarm" ADD COLUMN "tenantId" TEXT;

-- AlterTable
ALTER TABLE "AgroFarmTask" ADD COLUMN "jobTaskId" TEXT;

-- CreateIndex
CREATE INDEX "AgroFarm_tenantId_idx" ON "AgroFarm"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AgroFarmTask_jobTaskId_key" ON "AgroFarmTask"("jobTaskId");

-- AddForeignKey
ALTER TABLE "AgroFarm" ADD CONSTRAINT "AgroFarm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroFarmTask" ADD CONSTRAINT "AgroFarmTask_jobTaskId_fkey" FOREIGN KEY ("jobTaskId") REFERENCES "JobTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill 1: tenant de fincas existentes, solo cuando el propietario pertenece
-- a exactamente un tenant (membresías ACTIVE). Si es ambiguo, queda NULL.
UPDATE "AgroFarm" f
SET "tenantId" = owner_tenant."tenantId"
FROM (
  SELECT m."userId", MIN(o."tenantId") AS "tenantId"
  FROM "Membership" m
  JOIN "Org" o ON o."id" = m."orgId"
  WHERE m."status" = 'ACTIVE'
  GROUP BY m."userId"
  HAVING COUNT(DISTINCT o."tenantId") = 1
) owner_tenant
WHERE f."ownerId" = owner_tenant."userId"
  AND f."tenantId" IS NULL;

-- Backfill 2: espejo JobTask de las tareas de fincas con tenant.
-- id determinista 'agrotask_' || id, igual que AgroJobTaskMirror.
INSERT INTO "JobTask" (
  "id", "tenantId", "title", "dueDate", "priority", "status", "assignedTo", "createdBy",
  "farmId", "targetType", "targetId", "taskType", "startedAt", "completedAt", "blockedAt",
  "canceledAt", "blockReason", "cancelReason", "notes",
  "sourceTool", "domain", "vertical", "entityType", "entityId", "createdAt", "updatedAt"
)
SELECT
  'agrotask_' || t."id", f."tenantId", t."title", t."dueAt", LOWER(t."priority"),
  CASE t."status"
    WHEN 'PENDING' THEN 'pending'
    WHEN 'IN_PROGRESS' THEN 'in_progress'
    WHEN 'COMPLETED' THEN 'done'
    WHEN 'BLOCKED' THEN 'blocked'
    WHEN 'CANCELLED' THEN 'canceled'
    ELSE 'pending'
  END,
  t."assignedToId", COALESCE(f."ownerId", 'system'),
  t."farmId", t."targetType", t."targetId", t."type", t."startedAt", t."completedAt", t."blockedAt",
  t."cancelledAt", t."blockReason", t."cancelReason", t."notes",
  'agro_farm_task', 'agro', 'agro', 'AgroFarm', t."farmId", t."createdAt", CURRENT_TIMESTAMP
FROM "AgroFarmTask" t
JOIN "AgroFarm" f ON f."id" = t."farmId"
WHERE f."tenantId" IS NOT NULL
  AND t."jobTaskId" IS NULL
ON CONFLICT ("id") DO NOTHING;

UPDATE "AgroFarmTask" t
SET "jobTaskId" = 'agrotask_' || t."id"
FROM "AgroFarm" f
WHERE f."id" = t."farmId"
  AND f."tenantId" IS NOT NULL
  AND t."jobTaskId" IS NULL
  AND EXISTS (SELECT 1 FROM "JobTask" j WHERE j."id" = 'agrotask_' || t."id");
