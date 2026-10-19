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
  const suffix = randomUUID().slice(0, 8);
  const tA = "curated-a-" + suffix;
  const tB = "curated-b-" + suffix;
  const orgA = "curated-org-a-" + suffix;
  const orgB = "curated-org-b-" + suffix;
  const hash = createHash("sha256").update("Sanitized training-only example").digest("hex");
  const policyHash = createHash("sha256").update("scope=TENANT_CURATED;purpose=RAG_REFERENCE;v=1").digest("hex");
  const expiresAt = new Date(Date.now() + 86400000);

  try {
    await db.tenant.create({ data: { id: tA, slug: tA, name: "Curated tenant A" } });
    await db.tenant.create({ data: { id: tB, slug: tB, name: "Curated tenant B" } });
    await db.org.create({ data: { id: orgA, tenantId: tA, name: "A owner", type: "PRO" } });
    await db.org.create({ data: { id: orgB, tenantId: tB, name: "B owner", type: "PRO" } });

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
        actorUserId: "contributor-A", scope: "TENANT_CURATED", purpose: "RAG_REFERENCE",
        versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
        noticeVersion: "2026-10-19-f1a", proofPrivateRef: "private-test-proof",
      },
    });
    assert.equal(consent.legalBasisReviewed, false);
    assert.equal(consent.purpose, "RAG_REFERENCE");
    assert.ok(consent.expiresAt.getTime() > Date.now());
    assert.equal(consent.withdrawnAt, null);
    await assert.rejects(db.curatedPublicationConsent.create({
      data: {
        tenantId: tA, versionId: version.id, actorType: "CONTRIBUTOR",
        actorUserId: "contributor-A", scope: "TENANT_CURATED",
        purpose: "MODEL_TRAINING" as never,
        versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
        noticeVersion: "invalid-purpose",
      },
    }), "Free-text model training purposes must be rejected by the closed consent enum");
    await assert.rejects(db.curatedPublicationConsent.create({
      data: {
        tenantId: tA, versionId: version.id, actorType: "CONTRIBUTOR",
        actorUserId: "contributor-A", scope: "TENANT_CURATED",
        purpose: "RAG_REFERENCE",
        versionContentSha256: hash, audiencePolicySha256: policyHash,
        expiresAt: new Date(Date.now() - 86400000),
        noticeVersion: "expired",
      },
    }), "An expired or indefinite permission is not an allowed F1A consent");
    await assert.rejects(db.curatedPublicationConsent.create({
      data: {
        tenantId: tA, versionId: version.id, actorType: "RIGHTS_HOLDER",
        actorUserId: "unknown-representative", scope: "TENANT_CURATED",
        purpose: "RAG_REFERENCE",
        versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
        noticeVersion: "no-org",
      },
    }), "An org-rights signature without rights-holder organization must be rejected");
    await assert.rejects(db.curatedPublicationConsent.create({
      data: {
        tenantId: tA, versionId: version.id, actorType: "RIGHTS_HOLDER",
        actorUserId: "impostor", rightsHolderOrgId: orgB,
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
        actorUserId: "attacker-B", scope: "TENANT_CURATED", purpose: "RAG_REFERENCE",
        versionContentSha256: hash, audiencePolicySha256: policyHash, expiresAt,
        noticeVersion: "forged",
      },
    }), (e: any) => e.code === "P2003",
    "A consent cannot be linked to another tenant's derived version");

    await db.curatedPublicationConsent.update({
      where: { id: consent.id }, data: { withdrawnAt: new Date(), withdrawnByUserId: "contributor-A" },
    });
    assert.ok((await db.curatedPublicationConsent.findUnique({ where: { id: consent.id } }))?.withdrawnAt);

    const listB = await db.curatedKnowledgeEntry.findMany({ where: { tenantId: tB } });
    assert.equal(listB.length, 0, "New curated artifacts are not copied across tenants");
  } finally {
    await db.curatedPublicationConsent.deleteMany({ where: { tenantId: { in: [tA, tB] } } });
    await db.curatedKnowledgeVersion.deleteMany({ where: { tenantId: { in: [tA, tB] } } });
    await db.curatedKnowledgeEntry.deleteMany({ where: { tenantId: { in: [tA, tB] } } });
    await db.org.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await db.tenant.deleteMany({ where: { id: { in: [tA, tB] } } });
    await db.$disconnect();
  }
});
