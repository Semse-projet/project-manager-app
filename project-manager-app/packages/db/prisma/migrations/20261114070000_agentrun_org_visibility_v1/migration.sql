-- #1153: explicit owner for newly created AgentRuns.
-- Legacy records stay NULL, inaccessible to ordinary org-scoped reads.
-- No inference/backfill from untrusted inputJson, IDs, or correlation identifiers.
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "orgId" TEXT;
CREATE INDEX IF NOT EXISTS "AgentRun_tenantId_orgId_createdAt_idx"
  ON "AgentRun"("tenantId", "orgId", "createdAt");
