-- F1A additive security hardening: mixed SERIALIZABLE / READ COMMITTED
-- snapshots can miss a tombstone committed after the SERIALIZABLE snapshot.
-- Advisory locks serialize lock acquisition but do not refresh a stale
-- transaction snapshot. F1A is private/off and has no public write API.
-- Require READ COMMITTED consistently for guarded F1A writes.
-- This deliberately supersedes the earlier function without rewriting
-- checksums of already applied migrations.
CREATE OR REPLACE FUNCTION "curated_f1a_reject_stale_snapshot"()
RETURNS void AS $f1a_isolation$
BEGIN
 IF current_setting('transaction_isolation') <> 'read committed' THEN
  RAISE EXCEPTION 'curated F1A protected write requires READ COMMITTED'
    USING ERRCODE = '25000';
 END IF;
END;
$f1a_isolation$ LANGUAGE plpgsql;

-- This function is already invoked by the consent INSERT/DELETE guards,
-- version INSERT, entry provenance and historical identity guards.
-- First-time consent grants are not allowed under REPEATABLE READ or
-- SERIALIZABLE. No change to the product's private DRAFT/ORG_PRIVATE scope.
