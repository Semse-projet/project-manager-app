-- BO-05 business-offers: tablas aditivas, sin backfill ni DML.
CREATE TABLE "BusinessOffer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "issuedByUserId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "classificationDeclared" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "compensationNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessEngagement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "activatedByUserId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "legalConfirmedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endedByUserId" TEXT,
    "endedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessEngagement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessOffer_tenantId_orgId_status_createdAt_idx" ON "BusinessOffer"("tenantId", "orgId", "status", "createdAt");
CREATE INDEX "BusinessOffer_recipientUserId_status_idx" ON "BusinessOffer"("recipientUserId", "status");
CREATE UNIQUE INDEX "BusinessEngagement_offerId_key" ON "BusinessEngagement"("offerId");
CREATE INDEX "BusinessEngagement_tenantId_orgId_status_idx" ON "BusinessEngagement"("tenantId", "orgId", "status");
CREATE INDEX "BusinessEngagement_userId_status_idx" ON "BusinessEngagement"("userId", "status");

ALTER TABLE "BusinessOffer" ADD CONSTRAINT "BusinessOffer_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessEngagement" ADD CONSTRAINT "BusinessEngagement_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessEngagement" ADD CONSTRAINT "BusinessEngagement_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "BusinessOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
