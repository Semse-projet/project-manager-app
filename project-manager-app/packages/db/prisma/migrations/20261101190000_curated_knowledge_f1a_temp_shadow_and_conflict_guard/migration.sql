-- F1A additive hardening following the latest Codex/Copilot review.
-- Keep previously applied migrations immutable.
-- These functions are SECURITY INVOKER and use trusted catalog + public
-- objects before pg_temp; temp tables must never shadow tombstone lookups.
-- DB operators must restrict untrusted CREATE on the public schema.

ALTER FUNCTION "curated_f1a_source_guard"() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION "curated_f1a_version_deleted"() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION "curated_f1a_version_inserted"() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION "curated_f1a_consent_immutable"() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION "curated_f1a_reject_tombstone_mutation"() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION "curated_f1a_lock_source_during_version_insert"() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION "curated_f1a_no_prewithdrawn_consent"() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION "curated_f1a_reject_stale_snapshot"() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION "curated_f1a_entry_history_guard"() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION "curated_f1a_entry_identity_guard"() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION "curated_f1a_reject_recycled_entry"() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION "curated_f1a_entry_no_truncate"() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION "curated_f1a_version_no_truncate"() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION "curated_f1a_consent_deleted"() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION "curated_f1a_reject_replayed_consent"() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION "curated_f1a_consent_no_truncate"() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION "curated_f1a_consent_id_immutable"() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION "curated_f1a_lock_version"(text, text, text, integer)
  SET search_path = pg_catalog, public, pg_temp;

-- BEFORE INSERT must only lock the parent: PostgreSQL executes BEFORE
-- row triggers even if INSERT ... ON CONFLICT DO NOTHING skips the row.
-- The history latch moves into AFTER INSERT and changes only on a real insert.
CREATE OR REPLACE FUNCTION "curated_f1a_lock_source_during_version_insert"()
RETURNS trigger AS $f1a_parent_lock$
BEGIN
 PERFORM "curated_f1a_reject_stale_snapshot"();
 PERFORM 1 FROM "CuratedKnowledgeEntry"
  WHERE "id"=NEW."entryId" AND "tenantId"=NEW."tenantId" FOR UPDATE;
 -- Missing/cross-tenant parent is rejected by the existing composite FK.
 RETURN NEW;
END;
$f1a_parent_lock$ LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp;

CREATE FUNCTION "curated_f1a_mark_source_after_version_insert"()
RETURNS trigger AS $f1a_mark$
BEGIN
 PERFORM "curated_f1a_reject_stale_snapshot"();
 UPDATE "CuratedKnowledgeEntry" SET "versionEverCreated"=TRUE
  WHERE "id"=NEW."entryId" AND "tenantId"=NEW."tenantId";
 RETURN NEW;
END;
$f1a_mark$ LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp;

CREATE TRIGGER "curated_f1a_mark_source_when_version_inserted"
 AFTER INSERT ON "CuratedKnowledgeVersion" FOR EACH ROW
 EXECUTE FUNCTION "curated_f1a_mark_source_after_version_insert"();

-- No F1B endpoints, grants, RAG/publication, user data or production DDL.
