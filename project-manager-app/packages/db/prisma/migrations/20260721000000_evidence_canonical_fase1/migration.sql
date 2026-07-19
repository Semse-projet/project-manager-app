-- Fase 1 de documentos/evidencias: extiende Evidence para que pueda actuar como
-- entidad canónica de evidencia operativa y, en Fase 2, absorber AgroEvidenceItem.

-- Añadir columnas de contexto polimórfico y campos agro
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "entityType" TEXT;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "entityId" TEXT;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "farmId" TEXT;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "mediaType" TEXT;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "capturedById" TEXT;

-- Rellenar tenantId desde el proyecto asociado (toda Evidence existente está vinculada a un project)
UPDATE "Evidence"
SET "tenantId" = "Project"."tenantId"
FROM "Project"
WHERE "Evidence"."projectId" = "Project"."id";

-- Asegurar que no queden filas sin tenantId
ALTER TABLE "Evidence" ALTER COLUMN "tenantId" SET NOT NULL;

-- Foreign keys
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Índices para el nuevo shape canónico
CREATE INDEX IF NOT EXISTS "Evidence_tenantId_createdAt_idx" ON "Evidence"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Evidence_tenantId_entityType_entityId_idx" ON "Evidence"("tenantId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "Evidence_tenantId_farmId_idx" ON "Evidence"("tenantId", "farmId");
