-- Follow-up hardening of private F1A custody. Prior migrations remain untouched.
-- No sharing, public content, API grants, data migration or RAG activation.

-- The reservation for a deleted version is itself immutable. Otherwise an
-- application-level delete of the tombstone could silently recycle its ID.
CREATE FUNCTION "curated_f1a_reject_tombstone_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'curated version tombstones are permanent and immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "curated_f1a_tombstone_no_mutation"
BEFORE UPDATE OR DELETE ON "CuratedKnowledgeVersionTombstone"
FOR EACH ROW EXECUTE FUNCTION "curated_f1a_reject_tombstone_mutation"();

CREATE TRIGGER "curated_f1a_tombstone_no_truncate"
BEFORE TRUNCATE ON "CuratedKnowledgeVersionTombstone"
FOR EACH STATEMENT EXECUTE FUNCTION "curated_f1a_reject_tombstone_mutation"();

-- A source-repoint update and the FIRST version insert must acquire a
-- conflicting lock on the same parent entry. The existing UPDATE trigger
-- then checks for committed versions once the competing insert finishes.
CREATE FUNCTION "curated_f1a_lock_source_during_version_insert"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "CuratedKnowledgeEntry"
   WHERE "id" = NEW."entryId" AND "tenantId" = NEW."tenantId"
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'curated version has no tenant-bound source entry';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "curated_f1a_version_source_lock"
BEFORE INSERT ON "CuratedKnowledgeVersion"
FOR EACH ROW EXECUTE FUNCTION "curated_f1a_lock_source_during_version_insert"();

-- The last deleted version is still provenance evidence. Freezing the source
-- must inspect both live versions and the permanent identity reservations.
CREATE OR REPLACE FUNCTION "curated_f1a_source_guard"() RETURNS trigger AS $
BEGIN
  IF OLD."sourcePrivateRef" IS DISTINCT FROM NEW."sourcePrivateRef"
    AND (
      EXISTS (SELECT 1 FROM "CuratedKnowledgeVersion"
              WHERE "tenantId"=OLD."tenantId" AND "entryId"=OLD."id")
      OR
      EXISTS (SELECT 1 FROM "CuratedKnowledgeVersionTombstone"
              WHERE "tenantId"=OLD."tenantId" AND "entryId"=OLD."id")
    )
  THEN
    RAISE EXCEPTION 'curated provenance is frozen after first version, including deleted versions';
  END IF;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- A rights-holder organization cannot have a second concurrently active
-- grant of the same version/scope/purpose through a different signer.
-- Signer membership/authority remains a separate F1B verification.
CREATE UNIQUE INDEX "CuratedPublicationConsent_one_active_holder_org_per_version"
ON "CuratedPublicationConsent"
 ("tenantId", "versionId", "rightsHolderOrgId", "scope", "purpose")
WHERE "actorType" = 'RIGHTS_HOLDER' AND "withdrawnAt" IS NULL;

-- Every withdrawal must identify a persisted user, without pretending that
-- user is automatically authorized to revoke on behalf of an organization.
ALTER TABLE "CuratedPublicationConsent"
  ADD CONSTRAINT "CuratedPublicationConsent_withdrawnByUserId_fkey"
  FOREIGN KEY ("withdrawnByUserId") REFERENCES "User" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CuratedPublicationConsent"
  ADD CONSTRAINT "CuratedPublicationConsent_withdrawal_attribution"
  CHECK (
    ("withdrawnAt" IS NULL AND "withdrawnByUserId" IS NULL)
    OR
    ("withdrawnAt" IS NOT NULL AND "withdrawnByUserId" IS NOT NULL)
  );

CREATE FUNCTION "curated_f1a_no_prewithdrawn_consent"() RETURNS trigger AS $$
BEGIN
  IF NEW."withdrawnAt" IS NOT NULL OR NEW."withdrawnByUserId" IS NOT NULL THEN
    RAISE EXCEPTION 'new curated consent must begin active; withdrawal is a separate audited transition';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "curated_f1a_consent_insert_not_withdrawn"
BEFORE INSERT ON "CuratedPublicationConsent"
FOR EACH ROW EXECUTE FUNCTION "curated_f1a_no_prewithdrawn_consent"();

-- This migration must fail if existing records violate the new constraints;
-- do not fill missing signer identities with invented users.
