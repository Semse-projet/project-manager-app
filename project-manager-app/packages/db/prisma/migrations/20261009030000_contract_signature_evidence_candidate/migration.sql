-- Additive, dormant record of independently captured contract-signing
-- artifacts. IMPORTANT: NOT a verified signature and NOT escrow authority.
-- No backfill: historical signedClientAt/signedProAt remain unverified.
-- No FK cascade: tenant/contract deletion must not silently erase evidence.
CREATE TABLE IF NOT EXISTS "ContractSignatureEvidenceCandidate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "externalRequestId" TEXT NOT NULL,
  "documentVersionSha256" TEXT NOT NULL,
  "signedPdfSha256" TEXT NOT NULL,
  "certificateSha256" TEXT NOT NULL,
  "signedPdfRef" TEXT NOT NULL,
  "certificateRef" TEXT NOT NULL,
  "signerProofsJson" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractSignatureEvidenceCandidate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContractSignatureEvidenceCandidate_pending_only"
    CHECK ("status" = 'PENDING_VERIFICATION')
);
CREATE UNIQUE INDEX IF NOT EXISTS "SignatureEvidenceCandidate_scope_uniq"
  ON "ContractSignatureEvidenceCandidate"(
    "tenantId", "connectionId", "providerId", "externalRequestId",
    "contractId", "documentVersionSha256"
  );
CREATE INDEX IF NOT EXISTS "SignatureEvidenceCandidate_contract_idx"
  ON "ContractSignatureEvidenceCandidate"("tenantId", "contractId", "createdAt");
