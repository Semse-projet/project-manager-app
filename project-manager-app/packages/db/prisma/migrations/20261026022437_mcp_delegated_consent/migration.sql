-- S1/D7 McpDelegatedConsent: tabla aditiva, sin backfill ni DML ni FK (Q3, Q6-X1).
-- Los índices únicos admiten varios NULL (filas anonimizadas o sin idempotencyKey).
-- CreateTable
CREATE TABLE "McpDelegatedConsent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "oauthIssuer" TEXT NOT NULL,
    "oauthClientId" TEXT NOT NULL,
    "resourceUri" TEXT NOT NULL,
    "scopeSet" TEXT[],
    "grantBindingDigest" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "authorizedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "revocationReasonCode" TEXT,
    "policyVersion" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "idempotencyKeyDigest" TEXT,
    "anonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpDelegatedConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "McpDelegatedConsent_tenantId_orgId_userId_status_expiresAt_idx" ON "McpDelegatedConsent"("tenantId", "orgId", "userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "McpDelegatedConsent_tenantId_sessionId_status_idx" ON "McpDelegatedConsent"("tenantId", "sessionId", "status");

-- CreateIndex
CREATE INDEX "McpDelegatedConsent_tenantId_oauthClientId_status_idx" ON "McpDelegatedConsent"("tenantId", "oauthClientId", "status");

-- CreateIndex
CREATE INDEX "McpDelegatedConsent_anonymizedAt_expiresAt_idx" ON "McpDelegatedConsent"("anonymizedAt", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "McpDelegatedConsent_tenantId_grantBindingDigest_key" ON "McpDelegatedConsent"("tenantId", "grantBindingDigest");

-- CreateIndex
CREATE UNIQUE INDEX "McpDelegatedConsent_tenantId_idempotencyKeyDigest_key" ON "McpDelegatedConsent"("tenantId", "idempotencyKeyDigest");
