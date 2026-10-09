-- Stage-only additive authority boundary. NEVER backfill or promote historical
-- signedClientAt/signedProAt or caller-supplied documentHash. This model has
-- NO public write route; a separate audited verifier must create its rows.
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "canonicalPdfSha256" TEXT;

CREATE TABLE IF NOT EXISTS "VerifiedContractExecution" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "documentVersionSha256" TEXT NOT NULL,
  "clientUserId" TEXT NOT NULL,
  "professionalUserId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "externalRequestId" TEXT NOT NULL,
  "signedPdfSha256" TEXT NOT NULL,
  "certificateSha256" TEXT NOT NULL,
  "auditLogSha256" TEXT NOT NULL,
  "signedPdfRef" TEXT NOT NULL,
  "certificateRef" TEXT NOT NULL,
  "auditLogRef" TEXT NOT NULL,
  "authorizedPolicyDecisionId" TEXT NOT NULL,
  "consentVerifiedAt" TIMESTAMP(3) NOT NULL,
  "cryptographicVerifiedAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifiedContractExecution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VerifiedContractExecution_status_chk"
    CHECK ("status" IN ('VERIFIED_EXECUTED','REVOKED','QUARANTINED')),
  CONSTRAINT "VerifiedContractExecution_sha256_chk"
    CHECK (
      "documentVersionSha256" ~ '^[0-9a-f]{64}$' AND
      "signedPdfSha256" ~ '^[0-9a-f]{64}$' AND
      "certificateSha256" ~ '^[0-9a-f]{64}$' AND
      "auditLogSha256" ~ '^[0-9a-f]{64}$'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS "VerifiedContractExecution_scope_uniq"
 ON "VerifiedContractExecution"("tenantId","contractId","documentVersionSha256");
CREATE UNIQUE INDEX IF NOT EXISTS "VerifiedContractExecution_external_uniq"
 ON "VerifiedContractExecution"("tenantId","connectionId","providerId","externalRequestId");
CREATE INDEX IF NOT EXISTS "VerifiedContractExecution_gate_idx"
 ON "VerifiedContractExecution"("tenantId","contractId","status");
