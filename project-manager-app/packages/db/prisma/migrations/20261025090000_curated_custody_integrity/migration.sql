-- Follow-on to F1A: private custody only. Do not rewrite the applied migration.
-- Atomic failure is intentional if existing consents have orphan actors or
-- duplicate active identities. Never fabricate identities or discard evidence.
BEGIN;

-- No FK/cascade to deletable content: opaque identities remain reserved after
-- content deletion. Contains no body, source reference or signature evidence.
CREATE TABLE "CuratedVersionIdentity" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  CONSTRAINT "CuratedVersionIdentity_tenantId_entryId_version_key"
    UNIQUE ("tenantId", "entryId", "version")
);
INSERT INTO "CuratedVersionIdentity" ("id", "tenantId", "entryId", "version")
  SELECT "id", "tenantId", "entryId", "version" FROM "CuratedKnowledgeVersion";

CREATE TABLE "CuratedConsentIdentity" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL);
INSERT INTO "CuratedConsentIdentity" ("id", "tenantId") SELECT "id", "tenantId" FROM "CuratedPublicationConsent";

CREATE FUNCTION "curated_block_identity_mutation"() RETURNS trigger AS $curated$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'curated identity reservations are permanent';
END;
$curated$ LANGUAGE plpgsql;
CREATE TRIGGER "curated_version_identity_immutable"
  BEFORE UPDATE OR DELETE ON "CuratedVersionIdentity"
  FOR EACH ROW EXECUTE FUNCTION "curated_block_identity_mutation"();
CREATE TRIGGER "curated_version_identity_no_truncate"
  BEFORE TRUNCATE ON "CuratedVersionIdentity"
  FOR EACH STATEMENT EXECUTE FUNCTION "curated_block_identity_mutation"();
CREATE TRIGGER "curated_consent_identity_immutable"
  BEFORE UPDATE OR DELETE ON "CuratedConsentIdentity"
  FOR EACH ROW EXECUTE FUNCTION "curated_block_identity_mutation"();
CREATE TRIGGER "curated_consent_identity_no_truncate"
  BEFORE TRUNCATE ON "CuratedConsentIdentity"
  FOR EACH STATEMENT EXECUTE FUNCTION "curated_block_identity_mutation"();

-- Old rows remain unknown (NULL capturedAt); copying today's Entry reference
-- into historical versions would fabricate provenance. No publication backfill.
ALTER TABLE "CuratedKnowledgeVersion"
  ADD COLUMN "sourcePrivateRef" TEXT,
  ADD COLUMN "sourceCapturedAt" TIMESTAMP(3);
CREATE FUNCTION "curated_capture_version_identity"() RETURNS trigger AS $curated$
BEGIN
  -- Serialize capture with a concurrent Entry source update. Qualify by tenant.
  SELECT "sourcePrivateRef" INTO NEW."sourcePrivateRef"
    FROM "CuratedKnowledgeEntry"
    WHERE "id" = NEW."entryId" AND "tenantId" = NEW."tenantId" FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'curated entry not found';
  END IF;
  NEW."sourceCapturedAt" := statement_timestamp();
  INSERT INTO "CuratedVersionIdentity" ("id", "tenantId", "entryId", "version")
    VALUES (NEW."id", NEW."tenantId", NEW."entryId", NEW."version");
  RETURN NEW;
END;
$curated$ LANGUAGE plpgsql;
CREATE TRIGGER "curated_capture_version_identity"
  BEFORE INSERT ON "CuratedKnowledgeVersion"
  FOR EACH ROW EXECUTE FUNCTION "curated_capture_version_identity"();

ALTER TABLE "CuratedPublicationConsent"
  ADD CONSTRAINT "CuratedPublicationConsent_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "CuratedPublicationConsent_withdrawnByUserId_fkey"
    FOREIGN KEY ("withdrawnByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "CuratedPublicationConsent_withdrawal_pair"
    CHECK (("withdrawnAt" IS NULL) = ("withdrawnByUserId" IS NULL));

-- A non-withdrawn identity remains reserved even when expired. Renewal first
-- retires the old grant through the audited API; expiry alone never grants access.
-- NULLS NOT DISTINCT is required for CONTRIBUTOR (rightsHolderOrgId=NULL).
CREATE UNIQUE INDEX "CuratedPublicationConsent_active_identity_key"
  ON "CuratedPublicationConsent" (
    "tenantId", "versionId", "actorType", "actorUserId", "rightsHolderOrgId",
    "scope", "purpose", "versionContentSha256", "audiencePolicySha256"
  ) NULLS NOT DISTINCT WHERE "withdrawnAt" IS NULL;

CREATE FUNCTION "curated_guard_consent"() RETURNS trigger AS $curated$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "CuratedConsentIdentity" ("id", "tenantId") VALUES (NEW."id", NEW."tenantId");
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'withdrawnAt' - 'withdrawnByUserId')
      IS DISTINCT FROM (to_jsonb(OLD) - 'withdrawnAt' - 'withdrawnByUserId') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'curated consent evidence is immutable';
  END IF;
  IF OLD."withdrawnAt" IS NOT NULL AND
    (NEW."withdrawnAt" IS DISTINCT FROM OLD."withdrawnAt" OR
     NEW."withdrawnByUserId" IS DISTINCT FROM OLD."withdrawnByUserId") THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'curated consent withdrawal is irreversible';
  END IF;
  RETURN NEW;
END;
$curated$ LANGUAGE plpgsql;
CREATE TRIGGER "curated_consent_insert_identity"
  BEFORE INSERT ON "CuratedPublicationConsent"
  FOR EACH ROW EXECUTE FUNCTION "curated_guard_consent"();
CREATE TRIGGER "curated_consent_immutable_evidence"
  BEFORE UPDATE ON "CuratedPublicationConsent"
  FOR EACH ROW EXECUTE FUNCTION "curated_guard_consent"();
COMMIT;
