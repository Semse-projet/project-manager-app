-- F1A additive integrity hardening: retain checksum of original 20261019090000.
-- Private-only; never enable curated publication, sharing, or historical backfill.

-- A source cannot be silently reassigned once a derived version exists.
CREATE FUNCTION "curated_f1a_source_guard"() RETURNS trigger AS $$
BEGIN
 IF OLD."sourcePrivateRef" IS DISTINCT FROM NEW."sourcePrivateRef"
 AND EXISTS (SELECT 1 FROM "CuratedKnowledgeVersion" WHERE "tenantId"=OLD."tenantId" AND "entryId"=OLD."id")
 THEN RAISE EXCEPTION 'immutable curated provenance cannot be repointed'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "curated_f1a_provenance_lock" BEFORE UPDATE OF "sourcePrivateRef"
 ON "CuratedKnowledgeEntry" FOR EACH ROW EXECUTE FUNCTION "curated_f1a_source_guard"();

-- Preserve a durable reservation on deletion, so ID and logical version
-- cannot be recreated with different content. No original body is copied.
CREATE TABLE "CuratedKnowledgeVersionTombstone" (
 "versionId" TEXT NOT NULL PRIMARY KEY,
 "tenantId" TEXT NOT NULL,
 "entryId" TEXT NOT NULL,
 "version" INTEGER NOT NULL,
 "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CuratedKnowledgeVersionTombstone_positive" CHECK ("version">0)
);
CREATE UNIQUE INDEX "CuratedKnowledgeVersionTombstone_tenantId_entryId_version_key"
 ON "CuratedKnowledgeVersionTombstone" ("tenantId","entryId","version");

CREATE FUNCTION "curated_f1a_lock_version"(vid TEXT, tid TEXT, eid TEXT, v INTEGER) RETURNS void AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('ck-vid'),hashtext(vid));
 PERFORM pg_advisory_xact_lock(hashtext('ck-entry-ver'),hashtext(tid || ':' || eid || ':' || v::text));
END; $$ LANGUAGE plpgsql;
CREATE FUNCTION "curated_f1a_version_deleted"() RETURNS trigger AS $$
BEGIN
 PERFORM "curated_f1a_lock_version"(OLD."id",OLD."tenantId",OLD."entryId",OLD."version");
 INSERT INTO "CuratedKnowledgeVersionTombstone" ("versionId","tenantId","entryId","version")
 VALUES (OLD."id",OLD."tenantId",OLD."entryId",OLD."version");
 RETURN OLD;
END; $$ LANGUAGE plpgsql;
CREATE FUNCTION "curated_f1a_version_inserted"() RETURNS trigger AS $$
BEGIN
 PERFORM "curated_f1a_lock_version"(NEW."id",NEW."tenantId",NEW."entryId",NEW."version");
 IF EXISTS (SELECT 1 FROM "CuratedKnowledgeVersionTombstone"
 WHERE "versionId"=NEW."id" OR
 ("tenantId"=NEW."tenantId" AND "entryId"=NEW."entryId" AND "version"=NEW."version"))
 THEN RAISE EXCEPTION 'curated version identity is permanently reserved'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "curated_f1a_version_insert_guard" BEFORE INSERT ON "CuratedKnowledgeVersion"
 FOR EACH ROW EXECUTE FUNCTION "curated_f1a_version_inserted"();
CREATE TRIGGER "curated_f1a_version_delete_tombstone" BEFORE DELETE ON "CuratedKnowledgeVersion"
 FOR EACH ROW EXECUTE FUNCTION "curated_f1a_version_deleted"();

-- Consent actor must be a persisted User, separate from authorization to
-- represent an organization (which F1B must check using active membership).
ALTER TABLE "CuratedPublicationConsent"
 ADD CONSTRAINT "CuratedPublicationConsent_actorUserId_fkey"
 FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
 ON DELETE RESTRICT ON UPDATE CASCADE;

-- An idempotency key cannot be replayed after withdrawal. An active consent
-- is unique across concurrent requests even with distinct request keys.
ALTER TABLE "CuratedPublicationConsent" ADD COLUMN "idempotencyKey" TEXT;
UPDATE "CuratedPublicationConsent" SET "idempotencyKey"='legacy:' || "id"
 WHERE "idempotencyKey" IS NULL;
ALTER TABLE "CuratedPublicationConsent" ALTER COLUMN "idempotencyKey" SET NOT NULL;
CREATE UNIQUE INDEX "CuratedPublicationConsent_idempotencyKey_key"
 ON "CuratedPublicationConsent" ("idempotencyKey");
CREATE UNIQUE INDEX "CuratedPublicationConsent_one_active_actor_per_version"
 ON "CuratedPublicationConsent"
 ("tenantId","versionId","actorType","actorUserId","scope","purpose",COALESCE("rightsHolderOrgId",''))
 WHERE "withdrawnAt" IS NULL;

-- Signature fields cannot be mutated. Withdrawal is an irreversible change.
CREATE FUNCTION "curated_f1a_consent_immutable"() RETURNS trigger AS $$
BEGIN
 IF ROW(OLD."tenantId",OLD."versionId",OLD."actorType",OLD."actorUserId",
 OLD."rightsHolderOrgId",OLD."scope",OLD."purpose",OLD."versionContentSha256",
 OLD."audiencePolicySha256",OLD."noticeVersion",OLD."expiresAt",
 OLD."proofPrivateRef",OLD."legalBasisReviewed",OLD."grantedAt",OLD."idempotencyKey")
 IS DISTINCT FROM
 ROW(NEW."tenantId",NEW."versionId",NEW."actorType",NEW."actorUserId",
 NEW."rightsHolderOrgId",NEW."scope",NEW."purpose",NEW."versionContentSha256",
 NEW."audiencePolicySha256",NEW."noticeVersion",NEW."expiresAt",
 NEW."proofPrivateRef",NEW."legalBasisReviewed",NEW."grantedAt",NEW."idempotencyKey")
 THEN RAISE EXCEPTION 'curated consent identity and evidence are immutable'; END IF;
 IF OLD."withdrawnAt" IS NOT NULL
 THEN RAISE EXCEPTION 'withdrawn consent cannot be reactivated'; END IF;
 IF NEW."withdrawnAt" IS NULL OR NEW."withdrawnByUserId" IS NULL
 THEN RAISE EXCEPTION 'only an attributed irreversible withdrawal is allowed'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "curated_f1a_consent_one_way"
 BEFORE UPDATE ON "CuratedPublicationConsent"
 FOR EACH ROW EXECUTE FUNCTION "curated_f1a_consent_immutable"();

-- Note: original F1A migration already enforces rights-holder Org presence.
