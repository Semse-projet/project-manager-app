ALTER TABLE "Job"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "Contract"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "Milestone"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "PaymentEscrow"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "Dispute"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Job_tenantId_clientOrgId_idx" ON "Job"("tenantId", "clientOrgId");
CREATE INDEX IF NOT EXISTS "Job_tenantId_deletedAt_idx" ON "Job"("tenantId", "deletedAt");

CREATE INDEX IF NOT EXISTS "Contract_clientOrgId_deletedAt_idx" ON "Contract"("clientOrgId", "deletedAt");
CREATE INDEX IF NOT EXISTS "Contract_professionalOrgId_deletedAt_idx" ON "Contract"("professionalOrgId", "deletedAt");

CREATE INDEX IF NOT EXISTS "Milestone_projectId_deletedAt_idx" ON "Milestone"("projectId", "deletedAt");
CREATE INDEX IF NOT EXISTS "PaymentEscrow_projectId_deletedAt_idx" ON "PaymentEscrow"("projectId", "deletedAt");

CREATE INDEX IF NOT EXISTS "Dispute_tenantId_projectId_status_idx" ON "Dispute"("tenantId", "projectId", "status");
CREATE INDEX IF NOT EXISTS "Dispute_tenantId_deletedAt_idx" ON "Dispute"("tenantId", "deletedAt");

CREATE INDEX IF NOT EXISTS "AgentRun_tenantId_correlationId_idx" ON "AgentRun"("tenantId", "correlationId");
