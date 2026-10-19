-- CK-F1A #992: additive, private-only custodial schema.
-- No legacy rows are backfilled; no records are published or searchable by RAG.
-- Run only after explicit schema/security approval and isolated staging validation.

CREATE TYPE "CuratedKnowledgeStatus" AS ENUM (
  'DRAFT', 'REDACTION_REVIEW', 'TECH_REVIEW', 'READY',
  'PUBLISHED', 'SUSPENDED', 'WITHDRAWN', 'SUPERSEDED'
);
CREATE TYPE "CuratedKnowledgeScope" AS ENUM ('ORG_PRIVATE', 'TENANT_CURATED');
CREATE TYPE "CuratedConsentActorType" AS ENUM ('CONTRIBUTOR', 'RIGHTS_HOLDER');
CREATE TYPE "CuratedConsentPurpose" AS ENUM ('RAG_REFERENCE');

-- Additional composite tenant FK target; Org.id is already globally unique.
CREATE UNIQUE INDEX "Org_id_tenantId_key" ON "Org" ("id", "tenantId");

CREATE TABLE "CuratedKnowledgeEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "owningOrgId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "sourcePrivateRef" TEXT,
  "trade" TEXT,
  "jurisdiction" TEXT,
  "status" "CuratedKnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
  "publicationScope" "CuratedKnowledgeScope" NOT NULL DEFAULT 'ORG_PRIVATE',
  "aggregateRevision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CuratedKnowledgeEntry_pkey" PRIMARY KEY ("id"),
  -- F1A carries data in custody but CANNOT publish. F2 must explicitly
  -- review and lift this constraint under a separately approved migration.
  CONSTRAINT "CuratedKnowledgeEntry_f1a_private_only"
    CHECK ("status" = 'DRAFT' AND "publicationScope" = 'ORG_PRIVATE')
);
CREATE UNIQUE INDEX "CuratedKnowledgeEntry_id_tenantId_key" ON "CuratedKnowledgeEntry" ("id", "tenantId");
CREATE INDEX "CuratedKnowledgeEntry_tenantId_owningOrgId_status_idx"
  ON "CuratedKnowledgeEntry" ("tenantId", "owningOrgId", "status");
ALTER TABLE "CuratedKnowledgeEntry" ADD CONSTRAINT "CuratedKnowledgeEntry_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuratedKnowledgeEntry" ADD CONSTRAINT "CuratedKnowledgeEntry_owningOrgId_tenantId_fkey"
  FOREIGN KEY ("owningOrgId", "tenantId") REFERENCES "Org" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CuratedKnowledgeVersion" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "sanitizedBody" TEXT NOT NULL,
  "contentSha256" TEXT NOT NULL,
  "referencesJson" JSONB,
  "redactionReportPrivateJson" JSONB,
  "language" TEXT NOT NULL DEFAULT 'es',
  "technicalRisk" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CuratedKnowledgeVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CuratedKnowledgeVersion_positive_version" CHECK ("version" > 0),
  CONSTRAINT "CuratedKnowledgeVersion_valid_sha256" CHECK ("contentSha256" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "CuratedKnowledgeVersion_id_tenantId_key" ON "CuratedKnowledgeVersion" ("id", "tenantId");
CREATE UNIQUE INDEX "CuratedKnowledgeVersion_tenantId_entryId_version_key"
  ON "CuratedKnowledgeVersion" ("tenantId", "entryId", "version");
CREATE INDEX "CuratedKnowledgeVersion_tenantId_entryId_createdAt_idx"
  ON "CuratedKnowledgeVersion" ("tenantId", "entryId", "createdAt");
ALTER TABLE "CuratedKnowledgeVersion" ADD CONSTRAINT "CuratedKnowledgeVersion_entryId_tenantId_fkey"
  FOREIGN KEY ("entryId", "tenantId") REFERENCES "CuratedKnowledgeEntry" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CuratedPublicationConsent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "actorType" "CuratedConsentActorType" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "rightsHolderOrgId" TEXT,
  "scope" "CuratedKnowledgeScope" NOT NULL,
  "purpose" "CuratedConsentPurpose" NOT NULL,
  "versionContentSha256" TEXT NOT NULL,
  "audiencePolicySha256" TEXT NOT NULL,
  "noticeVersion" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "proofPrivateRef" TEXT,
  "legalBasisReviewed" BOOLEAN NOT NULL DEFAULT false,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawnAt" TIMESTAMP(3),
  "withdrawnByUserId" TEXT,
  CONSTRAINT "CuratedPublicationConsent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CuratedPublicationConsent_valid_withdrawal" CHECK ("withdrawnAt" IS NULL OR "withdrawnAt" >= "grantedAt"),
  CONSTRAINT "CuratedPublicationConsent_finite_term" CHECK ("expiresAt" > "grantedAt"),
  CONSTRAINT "CuratedPublicationConsent_holder_org_required" CHECK ("actorType" <> 'RIGHTS_HOLDER' OR "rightsHolderOrgId" IS NOT NULL),
  CONSTRAINT "CuratedPublicationConsent_version_hash" CHECK ("versionContentSha256" ~ '^[0-9a-f]{64}
);
CREATE INDEX "CuratedPublicationConsent_tenantId_versionId_actorType_withdrawnAt_idx"
  ON "CuratedPublicationConsent" ("tenantId", "versionId", "actorType", "withdrawnAt");
CREATE INDEX "CuratedPublicationConsent_tenantId_actorUserId_grantedAt_idx"
  ON "CuratedPublicationConsent" ("tenantId", "actorUserId", "grantedAt");
ALTER TABLE "CuratedPublicationConsent" ADD CONSTRAINT "CuratedPublicationConsent_versionId_tenantId_fkey"
  FOREIGN KEY ("versionId", "tenantId") REFERENCES "CuratedKnowledgeVersion" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CuratedPublicationConsent" ADD CONSTRAINT "CuratedPublicationConsent_rightsHolderOrgId_tenantId_fkey"
  FOREIGN KEY ("rightsHolderOrgId", "tenantId") REFERENCES "Org" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;


-- Published technical versions are never edited in place. Even while private,
-- new content, new scope or new sources require a NEW version and approvals.
CREATE FUNCTION "curated_f1a_block_version_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'curated versions are immutable: create a new version';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "curated_f1a_immutable_version"
BEFORE UPDATE ON "CuratedKnowledgeVersion"
FOR EACH ROW EXECUTE FUNCTION "curated_f1a_block_version_update"();
),
  CONSTRAINT "CuratedPublicationConsent_policy_hash" CHECK ("audiencePolicySha256" ~ '^[0-9a-f]{64}
);
CREATE INDEX "CuratedPublicationConsent_tenantId_versionId_actorType_withdrawnAt_idx"
  ON "CuratedPublicationConsent" ("tenantId", "versionId", "actorType", "withdrawnAt");
CREATE INDEX "CuratedPublicationConsent_tenantId_actorUserId_grantedAt_idx"
  ON "CuratedPublicationConsent" ("tenantId", "actorUserId", "grantedAt");
ALTER TABLE "CuratedPublicationConsent" ADD CONSTRAINT "CuratedPublicationConsent_versionId_tenantId_fkey"
  FOREIGN KEY ("versionId", "tenantId") REFERENCES "CuratedKnowledgeVersion" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CuratedPublicationConsent" ADD CONSTRAINT "CuratedPublicationConsent_rightsHolderOrgId_tenantId_fkey"
  FOREIGN KEY ("rightsHolderOrgId", "tenantId") REFERENCES "Org" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;


-- Published technical versions are never edited in place. Even while private,
-- new content, new scope or new sources require a NEW version and approvals.
CREATE FUNCTION "curated_f1a_block_version_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'curated versions are immutable: create a new version';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "curated_f1a_immutable_version"
BEFORE UPDATE ON "CuratedKnowledgeVersion"
FOR EACH ROW EXECUTE FUNCTION "curated_f1a_block_version_update"();
)
);
CREATE INDEX "CuratedPublicationConsent_tenantId_versionId_actorType_withdrawnAt_idx"
  ON "CuratedPublicationConsent" ("tenantId", "versionId", "actorType", "withdrawnAt");
CREATE INDEX "CuratedPublicationConsent_tenantId_actorUserId_grantedAt_idx"
  ON "CuratedPublicationConsent" ("tenantId", "actorUserId", "grantedAt");
ALTER TABLE "CuratedPublicationConsent" ADD CONSTRAINT "CuratedPublicationConsent_versionId_tenantId_fkey"
  FOREIGN KEY ("versionId", "tenantId") REFERENCES "CuratedKnowledgeVersion" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CuratedPublicationConsent" ADD CONSTRAINT "CuratedPublicationConsent_rightsHolderOrgId_tenantId_fkey"
  FOREIGN KEY ("rightsHolderOrgId", "tenantId") REFERENCES "Org" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;


-- Published technical versions are never edited in place. Even while private,
-- new content, new scope or new sources require a NEW version and approvals.
CREATE FUNCTION "curated_f1a_block_version_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'curated versions are immutable: create a new version';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "curated_f1a_immutable_version"
BEFORE UPDATE ON "CuratedKnowledgeVersion"
FOR EACH ROW EXECUTE FUNCTION "curated_f1a_block_version_update"();
