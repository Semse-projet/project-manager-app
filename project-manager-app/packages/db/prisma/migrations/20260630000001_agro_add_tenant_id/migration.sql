-- Migration: agro_add_tenant_id
-- Adds tenantId to AgroFarm for multi-tenant isolation.
-- Existing rows get tenantId = '' (empty string) as a safe sentinel;
-- they must be backfilled by the application or an ops script before
-- tenant-scoped reads are enforced in production.

ALTER TABLE "AgroFarm" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT '';

-- Composite index for tenant + owner lookups (list farms per user within tenant)
CREATE INDEX "AgroFarm_tenantId_idx" ON "AgroFarm"("tenantId");
CREATE INDEX "AgroFarm_tenantId_ownerId_idx" ON "AgroFarm"("tenantId", "ownerId");

-- Drop the old single-column ownerId index (replaced by the composite above)
DROP INDEX IF EXISTS "AgroFarm_ownerId_idx";
