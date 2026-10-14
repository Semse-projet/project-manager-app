-- BO-01 org-invitations: tabla aditiva, sin backfill ni DML.
CREATE TABLE "OrgInvitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "inviterUserId" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactHash" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedByUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "canceledByUserId" TEXT,
    "cancelReason" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrgInvitation_tokenHash_key" ON "OrgInvitation"("tokenHash");
CREATE INDEX "OrgInvitation_tenantId_orgId_status_createdAt_idx" ON "OrgInvitation"("tenantId", "orgId", "status", "createdAt");
CREATE INDEX "OrgInvitation_orgId_contactHash_status_idx" ON "OrgInvitation"("orgId", "contactHash", "status");

ALTER TABLE "OrgInvitation" ADD CONSTRAINT "OrgInvitation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
