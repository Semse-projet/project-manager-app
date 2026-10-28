-- F1A additive corrections prompted by independent Codex + Copilot reviews
-- of f8ae9ecf. Keep earlier applied migration checksums unchanged.
-- Deliberately fail-closed: no publication and no external access.

-- 1. Persist the fact that an entry has ever acquired a version. A parent
-- row UPDATE (not merely SELECT FOR UPDATE) makes stale REPEATABLE READ
-- source updates fail with PostgreSQL serialization conflict.
ALTER TABLE "CuratedKnowledgeEntry"
  ADD COLUMN "versionEverCreated" BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE "CuratedKnowledgeEntry" AS e
 SET "versionEverCreated" = TRUE
 WHERE EXISTS (
   SELECT 1 FROM "CuratedKnowledgeVersion" AS v
   WHERE v."tenantId" = e."tenantId" AND v."entryId" = e."id"
 ) OR EXISTS (
   SELECT 1 FROM "CuratedKnowledgeVersionTombstone" AS t
   WHERE t."tenantId" = e."tenantId" AND t."entryId" = e."id"
 );

-- Known READ COMMITTED and SERIALIZABLE semantics are accepted for F1A.
-- REPEATABLE READ's pinned snapshot can miss a newly committed tombstone
-- even after a transaction-scoped advisory lock has been acquired.
-- Reject that unsupported isolation level rather than guessing visibility.
CREATE FUNCTION "curated_f1a_reject_stale_snapshot"() RETURNS void AS $curated$
BEGIN
 IF current_setting('transaction_isolation') = 'repeatable read' THEN
   RAISE EXCEPTION 'curated F1A write requires READ COMMITTED or SERIALIZABLE'
     USING ERRCODE = '25000';
 END IF;
END;
$curated$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "curated_f1a_lock_source_during_version_insert"()
RETURNS trigger AS $curated$
BEGIN
 PERFORM "curated_f1a_reject_stale_snapshot"();
 -- Real UPDATE is intentional: creates a write conflict for an old snapshot.
 -- Missing/cross-tenant parent is still rejected by the composite FK.
 UPDATE "CuratedKnowledgeEntry" SET "versionEverCreated" = TRUE
 WHERE "id"=NEW."entryId" AND "tenantId"=NEW."tenantId";
 RETURN NEW;
END;
$curated$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "curated_f1a_source_guard"()
RETURNS trigger AS $curated$
BEGIN
 PERFORM "curated_f1a_reject_stale_snapshot"();
 IF OLD."sourcePrivateRef" IS DISTINCT FROM NEW."sourcePrivateRef"
    AND OLD."versionEverCreated" THEN
  RAISE EXCEPTION 'source provenance is immutable after first version';
 END IF;
 RETURN NEW;
END;
$curated$ LANGUAGE plpgsql;

CREATE FUNCTION "curated_f1a_entry_history_guard"()
RETURNS trigger AS $curated$
BEGIN
 PERFORM "curated_f1a_reject_stale_snapshot"();
 IF TG_OP = 'DELETE' THEN
  IF OLD."versionEverCreated" THEN
   RAISE EXCEPTION 'cannot delete entry with historical versions';
  END IF;
  RETURN OLD;
 END IF;
 IF OLD."versionEverCreated" AND NOT NEW."versionEverCreated" THEN
  RAISE EXCEPTION 'entry version history cannot be reset';
 END IF;
 RETURN NEW;
END;
$curated$ LANGUAGE plpgsql;
CREATE TRIGGER "curated_f1a_protect_entry_delete"
 BEFORE DELETE ON "CuratedKnowledgeEntry" FOR EACH ROW
 EXECUTE FUNCTION "curated_f1a_entry_history_guard"();
CREATE TRIGGER "curated_f1a_protect_entry_history_flag"
 BEFORE UPDATE OF "versionEverCreated" ON "CuratedKnowledgeEntry"
 FOR EACH ROW EXECUTE FUNCTION "curated_f1a_entry_history_guard"();

-- Preserve identity/ownership of the historically versioned entry itself.
-- Unreviewed rekeying would let old tombstones point to a new source owner.
CREATE FUNCTION "curated_f1a_entry_identity_guard"()
RETURNS trigger AS $identityguard$
BEGIN
 PERFORM "curated_f1a_reject_stale_snapshot"();
 IF OLD."versionEverCreated" AND
    (OLD."id" IS DISTINCT FROM NEW."id"
     OR OLD."tenantId" IS DISTINCT FROM NEW."tenantId"
     OR OLD."owningOrgId" IS DISTINCT FROM NEW."owningOrgId"
     OR OLD."createdByUserId" IS DISTINCT FROM NEW."createdByUserId")
 THEN RAISE EXCEPTION 'curated historical entry identity/ownership is immutable'; END IF;
 RETURN NEW;
END;
$identityguard$ LANGUAGE plpgsql;
CREATE TRIGGER "curated_f1a_freeze_entry_identity"
 BEFORE UPDATE OF "id","tenantId","owningOrgId","createdByUserId"
 ON "CuratedKnowledgeEntry" FOR EACH ROW
 EXECUTE FUNCTION "curated_f1a_entry_identity_guard"();

-- Backfilled tombstones may refer to an entry removed BEFORE this migration.
-- Reject recreating its ID even if there is no current parent row to lock.
CREATE FUNCTION "curated_f1a_reject_recycled_entry"()
RETURNS trigger AS $identityguard$
BEGIN
 PERFORM "curated_f1a_reject_stale_snapshot"();
 IF EXISTS (SELECT 1 FROM "CuratedKnowledgeVersionTombstone"
      WHERE "tenantId"=NEW."tenantId" AND "entryId"=NEW."id") THEN
   RAISE EXCEPTION 'entry identity reserved by historical version tombstone';
 END IF;
 RETURN NEW;
END;
$identityguard$ LANGUAGE plpgsql;
CREATE TRIGGER "curated_f1a_entry_insert_no_recycle"
 BEFORE INSERT ON "CuratedKnowledgeEntry" FOR EACH ROW
 EXECUTE FUNCTION "curated_f1a_reject_recycled_entry"();

-- Even when only historical tombstones remain, TRUNCATE on the parent
-- bypasses DELETE guards and could allow silent replacement of provenance.
CREATE FUNCTION "curated_f1a_entry_no_truncate"()
RETURNS trigger AS $entryguard$
BEGIN
 RAISE EXCEPTION 'curated historical entries cannot be truncated';
END;
$entryguard$ LANGUAGE plpgsql;
CREATE TRIGGER "curated_f1a_no_entry_truncate"
 BEFORE TRUNCATE ON "CuratedKnowledgeEntry" FOR EACH STATEMENT
 EXECUTE FUNCTION "curated_f1a_entry_no_truncate"();

-- 2. TRUNCATE bypasses row-level DELETE triggers and must never bypass
-- version identity reservation. This also rejects TRUNCATE CASCADE.
CREATE FUNCTION "curated_f1a_version_no_truncate"()
RETURNS trigger AS $curated$
BEGIN
 RAISE EXCEPTION 'curated versions cannot be truncated';
END;
$curated$ LANGUAGE plpgsql;
CREATE TRIGGER "curated_f1a_no_version_truncate"
 BEFORE TRUNCATE ON "CuratedKnowledgeVersion"
 FOR EACH STATEMENT EXECUTE FUNCTION "curated_f1a_version_no_truncate"();

-- 3. Existing pre-delete version tombstones are immutable, but readers at
-- REPEATABLE READ could see stale snapshots. The existing insert trigger
-- delegates to this replacement function which explicitly rejects RR.
CREATE OR REPLACE FUNCTION "curated_f1a_version_inserted"()
RETURNS trigger AS $curated$
BEGIN
 PERFORM "curated_f1a_reject_stale_snapshot"();
 PERFORM "curated_f1a_lock_version"(NEW."id",NEW."tenantId",NEW."entryId",NEW."version");
 IF EXISTS (SELECT 1 FROM "CuratedKnowledgeVersionTombstone"
    WHERE "versionId"=NEW."id" OR
      ("tenantId"=NEW."tenantId" AND "entryId"=NEW."entryId"
       AND "version"=NEW."version"))
 THEN RAISE EXCEPTION 'deleted version identity is permanently reserved'; END IF;
 RETURN NEW;
END;
$curated$ LANGUAGE plpgsql;

-- 4. Contributor signers must not claim a rights-holder org to evade
-- deduplication by varying the otherwise optional organization field.
ALTER TABLE "CuratedPublicationConsent"
 ADD CONSTRAINT "CuratedPublicationConsent_contributor_no_holder_org"
 CHECK ("actorType" <> 'CONTRIBUTOR' OR "rightsHolderOrgId" IS NULL);
CREATE UNIQUE INDEX "CuratedPublicationConsent_one_active_contributor"
 ON "CuratedPublicationConsent"
 ("tenantId","versionId","actorUserId","scope","purpose")
 WHERE "actorType" = 'CONTRIBUTOR' AND "withdrawnAt" IS NULL;

-- 5. Consent DELETE must preserve the request identity and its withdrawal
-- marker, without forever storing the full proof or the signer. This table
-- is NOT an access grant or a substitute for F1B's audit and retention.
CREATE TABLE "CuratedPublicationConsentTombstone" (
 "consentId" TEXT NOT NULL PRIMARY KEY,
 "idempotencyKey" TEXT NOT NULL UNIQUE,
 "withdrawnAt" TIMESTAMP(3),
 "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE FUNCTION "curated_f1a_consent_deleted"()
RETURNS trigger AS $curated$
BEGIN
 PERFORM "curated_f1a_reject_stale_snapshot"();
 PERFORM pg_advisory_xact_lock(hashtext('ck-consent-id'),hashtext(OLD."id"));
 PERFORM pg_advisory_xact_lock(hashtext('ck-consent-key'),hashtext(OLD."idempotencyKey"));
 INSERT INTO "CuratedPublicationConsentTombstone"
   ("consentId","idempotencyKey","withdrawnAt")
 VALUES (OLD."id",OLD."idempotencyKey",OLD."withdrawnAt");
 RETURN OLD;
END;
$curated$ LANGUAGE plpgsql;

CREATE FUNCTION "curated_f1a_reject_replayed_consent"()
RETURNS trigger AS $curated$
BEGIN
 PERFORM "curated_f1a_reject_stale_snapshot"();
 PERFORM pg_advisory_xact_lock(hashtext('ck-consent-id'),hashtext(NEW."id"));
 PERFORM pg_advisory_xact_lock(hashtext('ck-consent-key'),hashtext(NEW."idempotencyKey"));
 IF EXISTS (
   SELECT 1 FROM "CuratedPublicationConsentTombstone"
   WHERE "consentId"=NEW."id" OR "idempotencyKey"=NEW."idempotencyKey"
 ) THEN RAISE EXCEPTION 'historical consent request cannot be replayed'; END IF;
 RETURN NEW;
END;
$curated$ LANGUAGE plpgsql;

CREATE TRIGGER "curated_f1a_consent_delete_tombstone"
 BEFORE DELETE ON "CuratedPublicationConsent" FOR EACH ROW
 EXECUTE FUNCTION "curated_f1a_consent_deleted"();
CREATE TRIGGER "curated_f1a_consent_insert_no_recycle"
 BEFORE INSERT ON "CuratedPublicationConsent" FOR EACH ROW
 EXECUTE FUNCTION "curated_f1a_reject_replayed_consent"();

CREATE TRIGGER "curated_f1a_no_consent_tombstone_update_delete"
 BEFORE UPDATE OR DELETE ON "CuratedPublicationConsentTombstone" FOR EACH ROW
 EXECUTE FUNCTION "curated_f1a_reject_tombstone_mutation"();
CREATE TRIGGER "curated_f1a_no_consent_tombstone_truncate"
 BEFORE TRUNCATE ON "CuratedPublicationConsentTombstone" FOR EACH STATEMENT
 EXECUTE FUNCTION "curated_f1a_reject_tombstone_mutation"();

CREATE FUNCTION "curated_f1a_consent_no_truncate"()
RETURNS trigger AS $curated$
BEGIN
 RAISE EXCEPTION 'curated consent records cannot be truncated';
END;
$curated$ LANGUAGE plpgsql;
CREATE TRIGGER "curated_f1a_no_consent_truncate"
 BEFORE TRUNCATE ON "CuratedPublicationConsent" FOR EACH STATEMENT
 EXECUTE FUNCTION "curated_f1a_consent_no_truncate"();

-- To limit retention to an approved period, F1B must explicitly implement
-- audited retention/erasure policies. These irreversible private-only
-- markers never activate RAG, sharing, training or payments.
