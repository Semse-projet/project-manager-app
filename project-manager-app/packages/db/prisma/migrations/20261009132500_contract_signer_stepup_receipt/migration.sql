-- Additive, tenant-scoped, append-only verified-step-up RECEIPT log.
-- Receipt issuance requires a separate authenticated challenge service and
-- server-side MAC. No history backfill, no webhook-supplied consent.
CREATE TABLE IF NOT EXISTS "ContractSignerStepUpReceipt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "externalRequestId" TEXT NOT NULL,
  "documentVersionSha256" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "providerRecipientId" TEXT NOT NULL,
  "authChallengeId" TEXT NOT NULL,
  "stepUpMethod" TEXT NOT NULL,
  "identityVerifiedAt" TEXT NOT NULL,
  "consentedAt" TEXT NOT NULL,
  "challengeExpiresAt" TEXT NOT NULL,
  "mac" TEXT NOT NULL,
  "issuerServiceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ContractSignerStepUpReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContractSignerStepUpReceipt_role_chk" CHECK ("role" IN ('client','professional')),
  CONSTRAINT "ContractSignerStepUpReceipt_method_chk"
    CHECK ("stepUpMethod" IN ('webauthn','totp','identity_provider')),
  CONSTRAINT "ContractSignerStepUpReceipt_hash_chk"
    CHECK ("documentVersionSha256" ~ '^[0-9a-f]{64}$' AND "mac" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS "ContractSignerStepUpReceipt_party_uniq"
 ON "ContractSignerStepUpReceipt"("tenantId","contractId","connectionId","providerId","externalRequestId","role");
CREATE UNIQUE INDEX IF NOT EXISTS "ContractSignerStepUpReceipt_challenge_uniq"
 ON "ContractSignerStepUpReceipt"("tenantId","authChallengeId");
CREATE INDEX IF NOT EXISTS "ContractSignerStepUpReceipt_contract_idx"
 ON "ContractSignerStepUpReceipt"("tenantId","contractId","revokedAt");
