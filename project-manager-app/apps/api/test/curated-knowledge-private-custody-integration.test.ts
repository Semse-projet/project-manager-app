/**
 * CK-F1A (#992): migrated PostgreSQL proof for private curated custody.
 * This is NOT publication or API authorization; those are blocked in F1B–F3.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const dbTest = process.env.DATABASE_URL ? test : test.skip;

dbTest("F1A: private defaults, tenant-bound FK, version immutability keys, and consent isolation", async () => {
  const db = new PrismaClient();
  const competingDb = new PrismaClient();
  const observerDb = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const tA = "curated-a-" + suffix;
  const tB = "curated-b-" + suffix;
  const orgA = "curated-org-a-" + suffix;
  const orgB = "curated-org-b-" + suffix;
  const hash = createHash("sha256").update("Sanitized training-only example").digest("hex");
  const policyHash = createHash("sha256").update("scope=TENANT_CURATED;purpose=RAG_REFERENCE;v=1").digest("hex");
  const actorId = "curated-user-" + suffix;
  const expiresAt = new Date(Date.now() + 86400000);

  try {
    await db.user.create({ data: { id: actorId, email: actorId + "@example.invalid" } });
    await db.tenant.create({ data: { id: tA, slug: tA, name: "Curated tenant A" } });
    await db.tenant.create({ data: { id: tB, slug: tB, name: "Curated tenant B" } });
    await db.org.create({ data: { id: orgA, tenantId: tA, name: "A owner", type: "PRO" } });
    await db.org.create({ data: { id: orgB, tenantId: tB, name: "B owner", type: "PRO" } });

    const privateEntry = await db.curatedKnowledgeEntry.create({
      data: { tenantId: tA, owningOrgId: orgA, createdByUserId: actorId, trade: "electrical", sourcePrivateRef: "synthetic-source-1" },
    });
    assert.equal(privateEntry.status, "DRAFT");
    assert.equal(privateEntry.publicationScope, "ORG_PRIVATE");
    assert.equal(privateEntry.aggregateRevision, 0);
    assert.equal(privateEntry.sourcePrivateRef, "synthetic-source-1");
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
        createdByUserId: actorId,
        title: "Electrical fault: synthetic diagnosis",
        sanitizedBody: "Sanitized training-only example",
        contentSha256: hash,
      },
    });
    assert.equal(version.tenantId, tA);
    assert.equal(version.contentSha256, hash);
    assert.equal(version.sourcePrivateRef, "synthetic-source-1");
    assert.ok(version.sourceCapturedAt);
    await db.curatedKnowledgeEntry.update({
      where: { id: privateEntry.id }, data: { sourcePrivateRef: "synthetic-source-2" },
    });
    assert.equal((await db.curatedKnowledgeVersion.findUniqueOrThrow({ where: { id: version.id } })).sourcePrivateRef,
      "synthetic-source-1", "Historical provenance must not follow mutable Entry metadata");

    const disposable = await db.curatedKnowledgeVersion.create({ data: {
      tenantId: tA, entryId: privateEntry.id, version: 2, createdByUserId: actorId,
      title: "Disposable synthetic version", sanitizedBody: "Test", contentSha256: hash,
    } });
    assert.equal(disposable.sourcePrivateRef, "synthetic-source-2");
    await db.curatedKnowledgeVersion.delete({ where: { id: disposable.id } });
    for (const replacement of [
      { id: disposable.id, version: 3 }, { id: randomUUID(), version: 2 },
    ]) {
      await assert.rejects(db.curatedKnowledgeVersion.create({ data: {
        ...replacement, tenantId: tA, entryId: privateEntry.id, createdByUserId: actorId,
        title: "Replacement", sanitizedBody: "Different", contentSha256: hash,
      } }), "Deleted version IDs AND ordinals must remain reserved");
    }
    await assert.rejects(db.curatedKnowledgeVersion.update({
      where: { id: version.id }, data: { sanitizedBody: "rewritten without a new version" },
    }), "Published/draft version text must never change in place");

    await assert.rejects(db.curatedKnowledgeVersion.create({
      data: {
        tenantId: tB, entryId: privateEntry.id, version: 2,
        createdByUserId: actorId, title: "Foreign", sanitizedBody: "Test",
        contentSha256: createHash("sha256").update("Test").digest("hex"),
      },
    }), (e: any) => e.code === "P2003",
    "Cross-tenant version reference must be rejected by PostgreSQL");

    await assert.rejects(db.curatedKnowledgeVersion.create({
      data: {
        tenantId: tA, entryId: privateEntry.id, version: 1,
        createdByUserId: actorId, title: "Duplicate",
        sanitizedBody: "duplicate", contentSha256: hash,
      },
    }), (e: any) => e.code === "P2002",
    "No silent overwrite of the immutable version number");

    const consent = await db.curatedPublicationConsent.create({
      data: {
        tenantId: tA, versionId: version.id, actorType: "CONTRIBUTOR",
        actorUserId: actorId, scope: "TENANT_CURATED", purpose: "RAG_REFERENCE",
        versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
        noticeVersion: "2026-10-19-f1a", proofPrivateRef: "private-test-proof",
      },
    });
    await assert.rejects(db.curatedPublicationConsent.create({ data: {
      ...consent, id: randomUUID(), actorUserId: "nonexistent-" + suffix,
    } }), (e: any) => e.code === "P2003", "Consent signer must be a persisted user");
    for (const mutation of [
      { actorUserId: "forged" }, { versionContentSha256: "a".repeat(64) },
      { audiencePolicySha256: "b".repeat(64) }, { noticeVersion: "changed" },
      { scope: "ORG_PRIVATE" as const }, { proofPrivateRef: "replacement" },
      { expiresAt: new Date(Date.now() + 172800000) }, { legalBasisReviewed: true },
    ]) {
      await assert.rejects(db.curatedPublicationConsent.update({
        where: { id: consent.id }, data: mutation,
      }), "Signed consent evidence must be immutable");
    }
    assert.equal(consent.legalBasisReviewed, false);
    assert.equal(consent.purpose, "RAG_REFERENCE");
    assert.ok(consent.expiresAt.getTime() > Date.now());
    assert.equal(consent.withdrawnAt, null);
    await assert.rejects(db.curatedPublicationConsent.create({
      data: {
        tenantId: tA, versionId: version.id, actorType: "CONTRIBUTOR",
        actorUserId: actorId, scope: "TENANT_CURATED",
        purpose: "MODEL_TRAINING" as never,
        versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
        noticeVersion: "invalid-purpose",
      },
    }), "Free-text model training purposes must be rejected by the closed consent enum");
    await assert.rejects(db.curatedPublicationConsent.create({
      data: {
        tenantId: tA, versionId: version.id, actorType: "CONTRIBUTOR",
        actorUserId: actorId, scope: "TENANT_CURATED",
        purpose: "RAG_REFERENCE",
        versionContentSha256: hash, audiencePolicySha256: policyHash,
        expiresAt: new Date(Date.now() - 86400000),
        noticeVersion: "expired",
      },
    }), "An expired or indefinite permission is not an allowed F1A consent");
    await assert.rejects(db.curatedPublicationConsent.create({
      data: {
        tenantId: tA, versionId: version.id, actorType: "RIGHTS_HOLDER",
        actorUserId: actorId, scope: "TENANT_CURATED",
        purpose: "RAG_REFERENCE",
        versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
        noticeVersion: "no-org",
      },
    }), "An org-rights signature without rights-holder organization must be rejected");
    await assert.rejects(db.curatedPublicationConsent.create({
      data: {
        tenantId: tA, versionId: version.id, actorType: "RIGHTS_HOLDER",
        actorUserId: actorId, rightsHolderOrgId: orgB,
        scope: "TENANT_CURATED", purpose: "RAG_REFERENCE",
        versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
        noticeVersion: "forged",
      },
    }), (e: any) => e.code === "P2003",
    "An asserted rights-holder organization must belong to the version's tenant");
    // A saved expression of consent is NOT a publication or a sharing grant.
    assert.equal((await db.curatedKnowledgeEntry.findUnique({ where: { id: privateEntry.id } }))?.status, "DRAFT");

    await assert.rejects(db.curatedPublicationConsent.create({
      data: {
        tenantId: tB, versionId: version.id, actorType: "CONTRIBUTOR",
        actorUserId: actorId, scope: "TENANT_CURATED", purpose: "RAG_REFERENCE",
        versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
        noticeVersion: "forged",
      },
    }), (e: any) => e.code === "P2003",
    "A consent cannot be linked to another tenant's derived version");

    await db.curatedPublicationConsent.update({
      where: { id: consent.id }, data: { withdrawnAt: new Date(), withdrawnByUserId: actorId },
    });
    const withdrawn = await db.curatedPublicationConsent.findUniqueOrThrow({ where: { id: consent.id } });
    assert.ok(withdrawn.withdrawnAt);
    await assert.rejects(db.curatedPublicationConsent.update({
      where: { id: consent.id }, data: { withdrawnAt: null, withdrawnByUserId: null },
    }), "A withdrawn consent cannot be reactivated");
    await assert.rejects(db.curatedPublicationConsent.update({
      where: { id: consent.id }, data: { withdrawnAt: new Date(Date.now() + 10000) },
    }), "The original withdrawal evidence cannot be rewritten");
    await db.curatedPublicationConsent.update({ where: { id: consent.id }, data: {
      withdrawnAt: withdrawn.withdrawnAt, withdrawnByUserId: actorId,
    } });

    const { id: _id, ...renewal } = consent;
    // Hold the first INSERT uncommitted; prove the competing connection is
    // blocked on a PostgreSQL lock before allowing the winning transaction out.
    let firstInserted!: () => void;
    const inserted = new Promise<void>((resolve) => { firstInserted = resolve; });
    let releaseFirst!: () => void;
    const released = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const first = db.$transaction(async (tx) => {
      const result = await tx.curatedPublicationConsent.create({ data: { ...renewal, id: randomUUID() } });
      firstInserted();
      await released;
      return result;
    }, { timeout: 15000 });
    // Avoid hanging if the first INSERT fails before reaching the barrier.
    await Promise.race([inserted, first.then(() => undefined)]);
    let secondPid!: (pid: number) => void;
    const pidReady = new Promise<number>((resolve) => { secondPid = resolve; });
    const second = competingDb.$transaction(async (tx) => {
      const [backend] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      secondPid(backend.pid);
      return tx.curatedPublicationConsent.create({ data: { ...renewal, id: randomUUID() } });
    }, { timeout: 15000 });
    const outcomes = Promise.allSettled([first, second]);
    try {
      const pid = await Promise.race([pidReady, second.then(() => { throw new Error("Missing competing backend"); })]);
      let observedLock = false;
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const [backend] = await observerDb.$queryRaw<Array<{ waiting: boolean }>>`
          SELECT wait_event_type = 'Lock' AS waiting FROM pg_stat_activity WHERE pid = ${pid}`;
        if (backend?.waiting) { observedLock = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.ok(observedLock, "The second connection must actually contend on the unique identity");
    } finally {
      releaseFirst();
      await outcomes;
    }
    const attempts = await outcomes;
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1,
      "Concurrent equivalent grants must leave exactly one non-withdrawn row, including NULL holder org");
    const active = await db.curatedPublicationConsent.findMany({ where: { tenantId: tA, withdrawnAt: null } });
    assert.equal(active.length, 1);
    await db.curatedPublicationConsent.update({ where: { id: active[0].id }, data: {
      withdrawnAt: new Date(), withdrawnByUserId: actorId,
    } });
    assert.equal(await db.curatedPublicationConsent.count({ where: { tenantId: tA, withdrawnAt: null } }), 0);

    const listB = await db.curatedKnowledgeEntry.findMany({ where: { tenantId: tB } });
    assert.equal(listB.length, 0, "New curated artifacts are not copied across tenants");
  } finally {
    await db.curatedPublicationConsent.deleteMany({ where: { tenantId: { in: [tA, tB] } } });
    await db.curatedKnowledgeVersion.deleteMany({ where: { tenantId: { in: [tA, tB] } } });
    await db.curatedKnowledgeEntry.deleteMany({ where: { tenantId: { in: [tA, tB] } } });
    await db.org.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await db.tenant.deleteMany({ where: { id: { in: [tA, tB] } } });
    await db.user.delete({ where: { id: actorId } });
    await observerDb.$disconnect();
    await competingDb.$disconnect();
    await db.$disconnect();
  }
});
