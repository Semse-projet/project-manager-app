-- Field-ops vendors were tenant-scoped. Several organizations share one tenant,
-- so a vendor (and its compliance documents) must belong to the creating org.
-- orgId is nullable: existing rows stay unassigned and are visible only to OPS
-- until an operator sets the owning organization. No backfill.

ALTER TABLE "Vendor" ADD COLUMN "orgId" TEXT;

CREATE INDEX "Vendor_tenantId_orgId_idx" ON "Vendor"("tenantId", "orgId");

ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE;
