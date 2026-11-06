-- P0 #974 S1: project-scoped, explicit and revocable Prometeo sharing.
-- No legacy/public_training backfill: every new grant is separately authorized.
CREATE TABLE "PrometeoDocumentGrant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "recipientOrgId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    CONSTRAINT "PrometeoDocumentGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrometeoDocumentGrant_documentId_recipientOrgId_key"
  ON "PrometeoDocumentGrant"("documentId","recipientOrgId");
CREATE INDEX "PrometeoDocumentGrant_tenantId_recipientOrgId_projectId_revokedAt_idx"
  ON "PrometeoDocumentGrant"("tenantId","recipientOrgId","projectId","revokedAt");

-- Database-enforced same-document, same-tenant, same-project relationship:
-- a grant for project A cannot authorize a document reassociated with B.
-- Prevent unreviewed project reassociations: require explicit grant cleanup.
CREATE UNIQUE INDEX "PrometeoDocument_id_tenantId_projectId_key"
  ON "PrometeoDocument"("id","tenantId","projectId");

ALTER TABLE "PrometeoDocumentGrant"
  ADD CONSTRAINT "PrometeoDocumentGrant_documentId_tenantId_projectId_fkey"
  FOREIGN KEY ("documentId","tenantId","projectId")
  REFERENCES "PrometeoDocument"("id","tenantId","projectId")
  ON DELETE CASCADE ON UPDATE RESTRICT;
