/**
 * CK-F1A (#992): migrated PostgreSQL proof for private curated custody.
 * This is NOT publication or API authorization; those are blocked in F1B–F3.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

// Permanent history guards intentionally prevent full fixture deletion.
// This test may retain only SYNTHETIC rows in the ephemeral GitHub Actions DB.
// Never run this suite against a persistent user/customer database.
const isEphemeralCiDb = process.env.CI === "true" &&
  /^postgres(?:ql)?:\/\/[^/]*@127\.0\.0\.1:5433\/semse(?:\?|$)/.test(process.env.DATABASE_URL ?? "");
const dbTest = isEphemeralCiDb ? test : test.skip;

dbTest("F1A: private defaults, tenant-bound FK, version immutability keys, and consent isolation", async () => {
  const db = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const tA = "curated-a-" + suffix;
  const tB = "curated-b-" + suffix;
  const orgA = "curated-org-a-" + suffix;
  const orgB = "curated-org-b-" + suffix;
  const userA = "curated-user-a-" + suffix;
  const userB = "curated-user-b-" + suffix;
  const hash = createHash("sha256").update("Sanitized training-only example").digest("hex");
  const policyHash = createHash("sha256").update("scope=TENANT_CURATED;purpose=RAG_REFERENCE;v=1").digest("hex");
  const expiresAt = new Date(Date.now() + 86400000);

  try {
    await db.tenant.create({ data: { id: tA, slug: tA, name: "Curated tenant A" } });
    await db.tenant.create({ data: { id: tB, slug: tB, name: "Curated tenant B" } });
    await db.org.create({ data: { id: orgA, tenantId: tA, name: "A owner", type: "PRO" } });
    await db.org.create({ data: { id: orgB, tenantId: tB, name: "B owner", type: "PRO" } });

    await db.user.create({ data: { id: userA, email: userA + "@example.invalid" } });
    await db.user.create({ data: { id: userB, email: userB + "@example.invalid" } });
    const privateEntry = await db.curatedKnowledgeEntry.create({
      data: { tenantId: tA, owningOrgId: orgA, createdByUserId: "contributor-A", trade: "electrical" },
    });
    assert.equal(privateEntry.status, "DRAFT");
    assert.equal(privateEntry.publicationScope, "ORG_PRIVATE");
    assert.equal(privateEntry.aggregateRevision, 0);
    assert.equal(privateEntry.sourcePrivateRef, null);
    await assert.rejects(db.curatedKnowledgeEntry.update({
      where: { id: privateEntry.id }, data: { status: "PUBLISHED", publicationScope: "TENANT_CURATED" },
    }), "F1A database constraint must forbid publishing even if a code path bypasses the flag");

    await assert.rejects(db.curatedKnowledgeEntry.create({
      data: { tenantId: tA, owningOrgId: orgB, createdByUserId: "forged-owner" },
    }), (e: any) => e.code === "P2003",
    "A tenant A entry cannot attach the tenant B organization by ID");

    const version = await db.curatedKnowledgeVersion.create({
      data: {
        tenantId: tA, entryId: privateEntry.id, version: 1,
        createdByUserId: "contributor-A",
        title: "Electrical fault: synthetic diagnosis",
        sanitizedBody: "Sanitized training-only example",
        contentSha256: hash,
      },
    });
    assert.equal(version.tenantId, tA);
    assert.equal(version.contentSha256, hash);
    await assert.rejects(db.curatedKnowledgeVersion.update({
      where: { id: version.id }, data: { sanitizedBody: "rewritten without a new version" },
    }), "Published/draft version text must never change in place");

    await assert.rejects(db.curatedKnowledgeVersion.create({
      data: {
        tenantId: tB, entryId: privateEntry.id, version: 2,
        createdByUserId: "attacker-B", title: "Foreign", sanitizedBody: "Test",
        contentSha256: createHash("sha256").update("Test").digest("hex"),
      },
    }), (e: any) => e.code === "P2003",
    "Cross-tenant version reference must be rejected by PostgreSQL");

    await assert.rejects(db.curatedKnowledgeVersion.create({
      data: {
        tenantId: tA, entryId: privateEntry.id, version: 1,
        createdByUserId: "contributor-A", title: "Duplicate",
        sanitizedBody: "duplicate", contentSha256: hash,
      },
    }), (e: any) => e.code === "P2002",
    "No silent overwrite of the immutable version number");

    const consent = await db.curatedPublicationConsent.create({
      data: {
        tenantId: tA, versionId: version.id, actorType: "CONTRIBUTOR",
        actorUserId: userA, scope: "TENANT_CURATED", purpose: "RAG_REFERENCE",
        versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
        noticeVersion: "2026-10-19-f1a", idempotencyKey: "ck-original-1-" + suffix, proofPrivateRef: "private-test-proof",
      },
    });
    assert.equal(consent.legalBasisReviewed, false);
    assert.equal(consent.purpose, "RAG_REFERENCE");
    assert.ok(consent.expiresAt.getTime() > Date.now());
    assert.equal(consent.withdrawnAt, null);
    // A direct PostgreSQL caller can bypass Prisma's Date checks.
    // 'infinity' compares greater than grantedAt, but is not a finite consent.
    await assert.rejects(db.$executeRawUnsafe(`
      INSERT INTO "CuratedPublicationConsent"
        ("id", "tenantId", "versionId", "actorType", "actorUserId",
         "scope", "purpose", "versionContentSha256", "audiencePolicySha256",
         "noticeVersion", "idempotencyKey", "expiresAt")
      VALUES ($1, $2, $3, 'CONTRIBUTOR', $4, 'TENANT_CURATED',
              'RAG_REFERENCE', $5, $6, 'infinity-sql-negative',
              $7, 'infinity'::timestamp(3))
    `, "ck-infinite-consent-" + suffix, tA, version.id, userB, hash,
      policyHash, "ck-infinite-key-" + suffix),
      /CuratedPublicationConsent_finite_timestamps/,
      "Raw SQL consent expiry infinity must fail the DB constraint");

    await assert.rejects(db.curatedPublicationConsent.create({
      data: {
        tenantId: tA, versionId: version.id, actorType: "CONTRIBUTOR",
        actorUserId: userA, scope: "TENANT_CURATED",
        purpose: "MODEL_TRAINING" as never,
        versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
        noticeVersion: "invalid-purpose", idempotencyKey: "ck-original-2-" + suffix,
      },
    }), "Free-text model training purposes must be rejected by the closed consent enum");
    await assert.rejects(db.curatedPublicationConsent.create({
      data: {
        tenantId: tA, versionId: version.id, actorType: "CONTRIBUTOR",
        actorUserId: userA, scope: "TENANT_CURATED",
        purpose: "RAG_REFERENCE",
        versionContentSha256: hash, audiencePolicySha256: policyHash,
        expiresAt: new Date(Date.now() - 86400000),
        noticeVersion: "expired", idempotencyKey: "ck-original-3-" + suffix,
      },
    }), "An expired or indefinite permission is not an allowed F1A consent");
    await assert.rejects(db.curatedPublicationConsent.create({
      data: {
        tenantId: tA, versionId: version.id, actorType: "RIGHTS_HOLDER",
        actorUserId: userA, scope: "TENANT_CURATED",
        purpose: "RAG_REFERENCE",
        versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
        noticeVersion: "no-org", idempotencyKey: "ck-original-4-" + suffix,
      },
    }), "An org-rights signature without rights-holder organization must be rejected");
    await assert.rejects(db.curatedPublicationConsent.create({
      data: {
        tenantId: tA, versionId: version.id, actorType: "RIGHTS_HOLDER",
        actorUserId: userB, rightsHolderOrgId: orgB,
        scope: "TENANT_CURATED", purpose: "RAG_REFERENCE",
        versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
        noticeVersion: "forged", idempotencyKey: "ck-original-5-" + suffix,
      },
    }), (e: any) => e.code === "P2003",
    "An asserted rights-holder organization must belong to the version's tenant");
    await assert.rejects(db.curatedPublicationConsent.create({ data: {
      tenantId: tA, versionId: version.id, actorType: "CONTRIBUTOR",
      actorUserId: "nonexistent-" + suffix, scope: "TENANT_CURATED",
      purpose: "RAG_REFERENCE", versionContentSha256: hash,
      audiencePolicySha256: policyHash, expiresAt, noticeVersion: "invalid-actor",
      idempotencyKey: "ck-nonexistent-" + suffix,
    }}), (e: any) => e.code === "P2003",
      "An unpersisted human cannot sign consent");
    await assert.rejects(db.curatedKnowledgeEntry.update({
      where: { id: privateEntry.id },
      data: { sourcePrivateRef: "repointed-after-version" },
    }), "Original provenance cannot be changed after version creation");

    // A saved expression of consent is NOT a publication or a sharing grant.
    assert.equal((await db.curatedKnowledgeEntry.findUnique({ where: { id: privateEntry.id } }))?.status, "DRAFT");

    await assert.rejects(db.curatedPublicationConsent.create({
      data: {
        tenantId: tB, versionId: version.id, actorType: "CONTRIBUTOR",
        actorUserId: userB, scope: "TENANT_CURATED", purpose: "RAG_REFERENCE",
        versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
        noticeVersion: "forged", idempotencyKey: "ck-original-6-" + suffix,
      },
    }), (e: any) => e.code === "P2003",
    "A consent cannot be linked to another tenant's derived version");

    await db.curatedPublicationConsent.update({
      where: { id: consent.id }, data: { withdrawnAt: new Date(), withdrawnByUserId: userA },
    });
    assert.ok((await db.curatedPublicationConsent.findUnique({ where: { id: consent.id } }))?.withdrawnAt);

    await assert.rejects(db.curatedPublicationConsent.update({
      where: { id: consent.id }, data: { withdrawnAt: null },
    }), "Withdrawn consent cannot be reactivated");
    await assert.rejects(db.curatedPublicationConsent.update({
      where: { id: consent.id }, data: { actorUserId: userB },
    }), "Signing identity cannot change");
    await assert.rejects(db.curatedPublicationConsent.create({ data: {
      tenantId: tA, versionId: version.id, actorType: "CONTRIBUTOR",
      actorUserId: userA, scope: "TENANT_CURATED", purpose: "RAG_REFERENCE",
      versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
      noticeVersion: "retry", idempotencyKey: "ck-original-1-" + suffix,
    }}), (e: any) => e.code === "P2002",
      "Replaying withdrawn idempotency key cannot restore consent");

    const second = await db.curatedKnowledgeVersion.create({ data: {
      tenantId: tA, entryId: privateEntry.id, version: 2,
      createdByUserId: userA, title: "Synthetic v2",
      sanitizedBody: "Second private version", contentSha256: hash,
    }});
    const concurrent = await Promise.allSettled([1, 2].map(i =>
      db.curatedPublicationConsent.create({ data: {
        tenantId: tA, versionId: second.id, actorType: "CONTRIBUTOR",
        actorUserId: userA, scope: "TENANT_CURATED", purpose: "RAG_REFERENCE",
        versionContentSha256: hash, audiencePolicySha256: policyHash,
        expiresAt, noticeVersion: "parallel", idempotencyKey: "ck-parallel-" + i + "-" + suffix,
      }})
    ));
    assert.equal(concurrent.filter(x => x.status === "fulfilled").length, 1,
      "Exactly one active same-actor/version consent can be created concurrently");

    const deleted = await db.curatedKnowledgeVersion.create({ data: {
      tenantId: tA, entryId: privateEntry.id, version: 3,
      createdByUserId: userA, title: "Deleted synthetic version",
      sanitizedBody: "Not publishable", contentSha256: hash,
    }});
    await db.curatedKnowledgeVersion.delete({ where: { id: deleted.id } });
    await assert.rejects(db.curatedKnowledgeVersion.create({ data: {
      id: deleted.id, tenantId: tA, entryId: privateEntry.id, version: 3,
      createdByUserId: userA, title: "Unsafe reissue",
      sanitizedBody: "Rewritten", contentSha256: hash,
    }}), "Deleted version ID cannot be reused");
    await assert.rejects(db.curatedKnowledgeVersion.create({ data: {
      tenantId: tA, entryId: privateEntry.id, version: 3,
      createdByUserId: userA, title: "Unsafe sequence reuse",
      sanitizedBody: "Rewritten", contentSha256: hash,
    }}), "Deleted version number cannot be reused");

    const tombstone = await db.curatedKnowledgeVersionTombstone.findUnique({
      where: { versionId: deleted.id },
    });
    assert.equal(tombstone?.version, 3, "Delete must preserve the version identity");
    await assert.rejects(db.curatedKnowledgeVersionTombstone.update({
      where: { versionId: deleted.id }, data: { version: 99 },
    }), "Version tombstones cannot be modified");
    await assert.rejects(db.curatedKnowledgeVersionTombstone.delete({
      where: { versionId: deleted.id },
    }), "Version tombstones cannot be deleted to bypass provenance");

    const legacyEntry = await db.curatedKnowledgeEntry.create({ data: {
      tenantId: tA, owningOrgId: orgA, createdByUserId: userA,
      sourcePrivateRef: "synthetic-private-source-original",
    } });
    const legacyVersion = await db.curatedKnowledgeVersion.create({ data: {
      tenantId: tA, entryId: legacyEntry.id, version: 1,
      createdByUserId: userA, title: "Synthetic historical version",
      sanitizedBody: "Historical safe example", contentSha256: hash,
    } });
    await db.curatedKnowledgeVersion.delete({ where: { id: legacyVersion.id } });
    await assert.rejects(db.curatedKnowledgeEntry.update({
      where: { id: legacyEntry.id },
      data: { sourcePrivateRef: "silently-reassigned-after-last-version" },
    }), "Source provenance stays frozen after every version is deleted");

    const holder = await db.curatedPublicationConsent.create({ data: {
      tenantId: tA, versionId: second.id, actorType: "RIGHTS_HOLDER",
      actorUserId: userA, rightsHolderOrgId: orgA, scope: "TENANT_CURATED",
      purpose: "RAG_REFERENCE", versionContentSha256: hash,
      audiencePolicySha256: policyHash, expiresAt,
      noticeVersion: "rights-holder-first", idempotencyKey: "ck-rights-first-" + suffix,
    } });
    await assert.rejects(db.curatedPublicationConsent.create({ data: {
      tenantId: tA, versionId: second.id, actorType: "RIGHTS_HOLDER",
      actorUserId: userB, rightsHolderOrgId: orgA, scope: "TENANT_CURATED",
      purpose: "RAG_REFERENCE", versionContentSha256: hash,
      audiencePolicySha256: policyHash, expiresAt,
      noticeVersion: "rights-holder-second", idempotencyKey: "ck-rights-second-" + suffix,
    } }), (e: any) => e.code === "P2002",
      "Two representatives must not leave separate active consent for one rights-holder org");
    await assert.rejects(db.curatedPublicationConsent.update({
      where: { id: holder.id },
      data: { withdrawnAt: new Date(Date.now() + 1_000), withdrawnByUserId: "absent-" + suffix },
    }), (e: any) => e.code === "P2003",
      "Withdrawal witness must be a persisted user");
    await assert.rejects(db.curatedPublicationConsent.create({ data: {
      tenantId: tA, versionId: second.id, actorType: "RIGHTS_HOLDER",
      actorUserId: userB, rightsHolderOrgId: orgA, scope: "TENANT_CURATED",
      purpose: "RAG_REFERENCE", versionContentSha256: hash,
      audiencePolicySha256: policyHash, expiresAt,
      noticeVersion: "prewithdrawn-signature", idempotencyKey: "ck-prewithdrawn-" + suffix,
      withdrawnAt: new Date(Date.now() + 2_000), withdrawnByUserId: userB,
    } }), "Consent must not be inserted in an already withdrawn state");


    // Codex/Copilot current-head review: historical identities and DDL bypasses.
    assert.equal((await db.curatedKnowledgeEntry.findUnique({
      where: { id: legacyEntry.id },
    }))?.versionEverCreated, true, "Historical version latch must survive deletion");
    await assert.rejects(db.curatedKnowledgeEntry.delete({
      where: { id: legacyEntry.id },
    }), "A previously versioned entry cannot be deleted and recreated with another source");
    await assert.rejects(db.curatedKnowledgeEntry.update({
      where: { id: legacyEntry.id },
      data: { id: "curated-rekey-" + suffix },
    }), "Historical entry primary key cannot be reassigned");
    await assert.rejects(db.curatedKnowledgeEntry.update({
      where: { id: legacyEntry.id },
      data: { createdByUserId: userB },
    }), "Historical entry author cannot be rewritten");
    const archivedEntryId = "curated-previously-deleted-" + suffix;
    await db.curatedKnowledgeVersionTombstone.create({ data: {
      versionId: "curated-old-version-" + suffix,
      tenantId: tA, entryId: archivedEntryId, version: 1,
    } });
    await assert.rejects(db.curatedKnowledgeEntry.create({ data: {
      id: archivedEntryId, tenantId: tA, owningOrgId: orgA,
      createdByUserId: userB,
      sourcePrivateRef: "forged-source-" + suffix,
    } }), "A tombstone-only historical entry ID cannot be recycled");

    const unversionedEntry = await db.curatedKnowledgeEntry.create({ data: {
      tenantId: tA, owningOrgId: orgA, createdByUserId: userB,
      sourcePrivateRef: "forged-unversioned-source-" + suffix,
    } });
    await assert.rejects(db.curatedKnowledgeEntry.update({
      where: { id: unversionedEntry.id },
      data: { id: archivedEntryId },
    }), "Rekeying an unversioned entry onto a tombstone-only historical ID is forbidden");

    await assert.rejects(db.curatedKnowledgeEntry.update({
      where: { id: legacyEntry.id },
      data: { versionEverCreated: false },
    }), "Historical version latch cannot be reset");
    await assert.rejects(
      db.$executeRawUnsafe('TRUNCATE TABLE "CuratedKnowledgeEntry" CASCADE'),
      "Parent TRUNCATE cannot bypass historical provenance safeguards",
    );
    await assert.rejects(
      db.$executeRawUnsafe('TRUNCATE TABLE "CuratedKnowledgeVersion" CASCADE'),
      "TRUNCATE CASCADE cannot bypass version-delete tombstones",
    );
    await assert.rejects(
      db.$executeRawUnsafe('TRUNCATE TABLE "CuratedPublicationConsent" CASCADE'),
      "TRUNCATE CASCADE cannot erase consent identities",
    );

    await assert.rejects(db.curatedPublicationConsent.create({ data: {
      tenantId: tA, versionId: second.id, actorType: "CONTRIBUTOR",
      actorUserId: userA, rightsHolderOrgId: orgA,
      scope: "TENANT_CURATED", purpose: "RAG_REFERENCE",
      versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
      noticeVersion: "forged-contributor-holder",
      idempotencyKey: "ck-contributor-holder-" + suffix,
    } }), "Contributor cannot claim rights-holder organization to bypass deduplication");

    await db.curatedPublicationConsent.delete({ where: { id: consent.id } });
    const consentTombstone = await db.curatedPublicationConsentTombstone.findUnique({
      where: { consentId: consent.id },
    });
    assert.equal(consentTombstone?.idempotencyKey, "ck-original-1-" + suffix);
    assert.ok(consentTombstone?.withdrawnAt, "Withdrawn status must remain auditable");
    await assert.rejects(db.curatedPublicationConsent.update({
      where: { id: holder.id },
      data: {
        id: consent.id,
        withdrawnAt: new Date(Date.now() + 1_000),
        withdrawnByUserId: userA,
      },
    }), "First consent withdrawal cannot repoint its primary key onto tombstoned ID");
    assert.equal((await db.curatedPublicationConsent.findUnique({
      where: { id: holder.id },
    }))?.withdrawnAt, null, "Failed rekey must not partially withdraw or move consent");
    await assert.rejects(db.curatedPublicationConsent.create({ data: {
      id: consent.id, tenantId: tA, versionId: second.id,
      actorType: "CONTRIBUTOR", actorUserId: userB,
      scope: "TENANT_CURATED", purpose: "RAG_REFERENCE",
      versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
      noticeVersion: "recycled-consent-id", idempotencyKey: "ck-new-" + suffix,
    } }), "Deleted consent ID must not be re-used");
    await assert.rejects(db.curatedPublicationConsent.create({ data: {
      tenantId: tA, versionId: second.id, actorType: "CONTRIBUTOR",
      actorUserId: userB, scope: "TENANT_CURATED", purpose: "RAG_REFERENCE",
      versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
      noticeVersion: "recycled-consent-key", idempotencyKey: "ck-original-1-" + suffix,
    } }), "Deleted consent idempotency key must not be replayed");
    await assert.rejects(db.curatedPublicationConsentTombstone.delete({
      where: { consentId: consent.id },
    }), "Consent tombstones themselves must be immutable");

    // Two-connection regression: the RR snapshot predates the first version
    // created by a separate connection and must NOT permit source repoint.
    const raceEntry = await db.curatedKnowledgeEntry.create({ data: {
      tenantId: tA, owningOrgId: orgA, createdByUserId: userA,
      sourcePrivateRef: "race-original-" + suffix,
    } });
    let snapshotReady!: () => void;
    let continueOldSnapshot!: () => void;
    const snapshotIsReady = new Promise<void>(resolve => { snapshotReady = resolve; });
    const canContinue = new Promise<void>(resolve => { continueOldSnapshot = resolve; });
    const staleUpdate = db.$transaction(async tx => {
      await tx.curatedKnowledgeEntry.findUnique({ where: { id: raceEntry.id } });
      snapshotReady();
      await canContinue;
      return tx.curatedKnowledgeEntry.update({
        where: { id: raceEntry.id },
        data: { sourcePrivateRef: "race-forged-" + suffix },
      });
    }, { isolationLevel: "RepeatableRead", timeout: 20000 });
    await snapshotIsReady;
    try {
      await db.curatedKnowledgeVersion.create({ data: {
        tenantId: tA, entryId: raceEntry.id, version: 1,
        createdByUserId: userA, title: "Race synthetic",
        sanitizedBody: "Synthetic only", contentSha256: hash,
      } });
    } finally {
      continueOldSnapshot();
    }
    await assert.rejects(staleUpdate,
      "Old RR snapshot must never repoint a version's private source");

    const staleVersion = await db.curatedKnowledgeVersion.create({ data: {
      tenantId: tA, entryId: raceEntry.id, version: 2,
      createdByUserId: userA, title: "Version to delete in race",
      sanitizedBody: "Synthetic only", contentSha256: hash,
    } });
    let deletionSnapshotReady!: () => void;
    let continueAfterDelete!: () => void;
    const deletionReady = new Promise<void>(resolve => { deletionSnapshotReady = resolve; });
    const deletionDone = new Promise<void>(resolve => { continueAfterDelete = resolve; });
    const staleInsert = db.$transaction(async tx => {
      await tx.curatedKnowledgeEntry.findUnique({ where: { id: raceEntry.id } });
      deletionSnapshotReady();
      await deletionDone;
      return tx.curatedKnowledgeVersion.create({ data: {
        id: staleVersion.id, tenantId: tA, entryId: raceEntry.id,
        version: 2, createdByUserId: userB,
        title: "Recycled under stale snapshot",
        sanitizedBody: "Changed contents", contentSha256: hash,
      } });
    }, { isolationLevel: "RepeatableRead", timeout: 20000 });
    await deletionReady;
    try {
      await db.curatedKnowledgeVersion.delete({ where: { id: staleVersion.id } });
    } finally {
      continueAfterDelete();
    }
    await assert.rejects(staleInsert,
      "Old RR snapshot must not resurrect a deleted version identity");

    const listB = await db.curatedKnowledgeEntry.findMany({ where: { tenantId: tB } });
    assert.equal(listB.length, 0, "New curated artifacts are not copied across tenants");
  } finally {
    // F1A's durable audit invariants deliberately prevent deleting versioned
    // entries and consent identity reservations. This is a dedicated ephemeral
    // PostgreSQL CI service, not production. Synthetic fixtures remain until
    // the service is destroyed; NEVER weaken the triggers to clean them up.
    await db.$disconnect();
  }
});
