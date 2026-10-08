-- Additive, dormant signature-dispatch journal for SEMSE's provider-neutral signing engine.
-- PR is not wired to live contracts and does not send signature requests.
-- Historical signature requests remain untouched. Never cascade-delete this audit journal.
CREATE TABLE IF NOT EXISTS "SignatureDispatchOutbox" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "externalRequestId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SignatureDispatchOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SignatureDispatchOutbox_idempotency_uniq"
  ON "SignatureDispatchOutbox"("tenantId", "connectionId", "providerId", "contractId", "idempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "SignatureDispatchOutbox_external_uniq"
  ON "SignatureDispatchOutbox"("connectionId", "providerId", "externalRequestId");

CREATE INDEX IF NOT EXISTS "SignatureDispatchOutbox_reconcile_idx"
  ON "SignatureDispatchOutbox"("tenantId", "connectionId", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "SignatureDispatchOutbox_contract_idx"
  ON "SignatureDispatchOutbox"("tenantId", "contractId");
