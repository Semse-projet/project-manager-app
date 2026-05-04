CREATE TABLE "AgentRunIdempotency" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentRunIdempotency_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AgentRunIdempotency_tenantId_key_key" ON "AgentRunIdempotency"("tenantId", "key");
CREATE INDEX "AgentRunIdempotency_tenantId_expiresAt_idx" ON "AgentRunIdempotency"("tenantId", "expiresAt");
ALTER TABLE "AgentRunIdempotency" ADD CONSTRAINT "AgentRunIdempotency_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
