-- Repair production drift where the canonical Evidence migration is recorded
-- as applied but its tenant/context columns are absent from the live table.
-- Keep this migration additive and idempotent so clean databases and drifted
-- databases converge on the same Prisma contract.

ALTER TABLE "Evidence"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "entityType" TEXT,
  ADD COLUMN IF NOT EXISTS "entityId" TEXT,
  ADD COLUMN IF NOT EXISTS "farmId" TEXT,
  ADD COLUMN IF NOT EXISTS "mediaType" TEXT,
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "fileUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "capturedById" TEXT;

UPDATE "Evidence" AS evidence
SET "tenantId" = project."tenantId"
FROM "Project" AS project
WHERE evidence."projectId" = project.id
  AND evidence."tenantId" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Evidence"
    WHERE "tenantId" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Evidence tenantId repair failed: one or more rows have no canonical Project';
  END IF;
END
$$;

ALTER TABLE "Evidence"
  ALTER COLUMN "tenantId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Evidence_tenantId_fkey'
      AND conrelid = '"Evidence"'::regclass
  ) THEN
    ALTER TABLE "Evidence"
      ADD CONSTRAINT "Evidence_tenantId_fkey"
      FOREIGN KEY ("tenantId")
      REFERENCES "Tenant"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Evidence_farmId_fkey'
      AND conrelid = '"Evidence"'::regclass
  ) THEN
    ALTER TABLE "Evidence"
      ADD CONSTRAINT "Evidence_farmId_fkey"
      FOREIGN KEY ("farmId")
      REFERENCES "AgroFarm"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "Evidence_tenantId_createdAt_idx"
  ON "Evidence"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "Evidence_tenantId_entityType_entityId_idx"
  ON "Evidence"("tenantId", "entityType", "entityId");

CREATE INDEX IF NOT EXISTS "Evidence_tenantId_farmId_idx"
  ON "Evidence"("tenantId", "farmId");
