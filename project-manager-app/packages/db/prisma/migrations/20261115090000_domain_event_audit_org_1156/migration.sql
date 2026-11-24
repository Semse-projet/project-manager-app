-- #1156: retain verified org ownership for NEW audit entries.
-- Historical rows remain NULL; no client-controlled inference or automatic backfill.
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "orgId" TEXT;
CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_orgId_occurredAt_idx"
  ON "AuditLog"("tenantId", "orgId", "occurredAt");
