-- PostgreSQL 16 disposable CI fixture ONLY. NOT a production migration.
-- Schema subset reflects the exact columns read by the P0 aggregate query.
-- No personal data, actual tenants, historical records or Railway connection.
CREATE TABLE "Org" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL);
CREATE TABLE "Job" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "clientOrgId" TEXT NOT NULL);
CREATE TABLE "Project" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "jobId" TEXT NOT NULL, "assignedProOrgId" TEXT);
CREATE TABLE "PrometeoDocument" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "orgId" TEXT NOT NULL,
  "projectId" TEXT, "status" TEXT NOT NULL, "metadataJson" JSONB
);
CREATE TABLE "PrometeoDocumentGrant" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "documentId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL, "recipientOrgId" TEXT NOT NULL, "revokedAt" TIMESTAMP
);
CREATE TABLE "DocumentChunk" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "documentId" TEXT NOT NULL,
  "tokenCount" INTEGER NOT NULL
);
CREATE TABLE "PrometeoChunkFeedback" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "chunkId" TEXT NOT NULL, "documentId" TEXT NOT NULL
);
CREATE TABLE "AuditLog" ("id" TEXT PRIMARY KEY, "action" TEXT NOT NULL);

INSERT INTO "Org" VALUES ('fixture-owner','fixture-tenant'),('fixture-recipient','fixture-tenant');
INSERT INTO "Job" VALUES ('fixture-job','fixture-tenant','fixture-owner');
INSERT INTO "Project" VALUES ('fixture-project','fixture-tenant','fixture-job','fixture-recipient');
INSERT INTO "PrometeoDocument" VALUES
 ('fixture-doc','fixture-tenant','fixture-owner','fixture-project','indexed',
  '{"visibility":"project_private"}'::jsonb);
INSERT INTO "PrometeoDocumentGrant" VALUES
 ('fixture-grant','fixture-tenant','fixture-doc','fixture-project','fixture-recipient',NULL);
INSERT INTO "DocumentChunk" VALUES ('fixture-chunk','fixture-tenant','fixture-doc',4);
INSERT INTO "PrometeoChunkFeedback" VALUES
 ('fixture-feedback','fixture-tenant','fixture-chunk','fixture-doc');
INSERT INTO "AuditLog" VALUES ('fixture-audit','prometeo.document_share_granted');
