/**
 * P0 #974 — real PostgreSQL negative integration: tenant, org and project-scoped
 * document retrieval, chunk search, feedback aggregation and row mutation.
 * The API Integration workflow supplies an ephemeral migrated PostgreSQL 16.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: path.join(root, ".env") });
loadEnv({ path: path.join(root, "packages/db/.env") });
// The temporary PostgreSQL fixtures opt in; application production default stays OFF.
process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED = "true";
const dbTest = process.env.DATABASE_URL ? test : test.skip;

const id = (label: string) =>
  `p0_${label}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

dbTest("P0: physical Postgres enforces document/chunk/feedback tenant and org isolation before pagination", async () => {
  const { PrismaService } = await import("../dist/infrastructure/prisma/prisma.service.js");
  const { PrometeoRepository } = await import("../dist/modules/prometeo/prometeo.repository.js");
  const { PrometeoAccessPolicy } = await import("../dist/modules/prometeo/prometeo-access.policy.js");
  const { ResourceScopeResolver } = await import("../dist/common/resource-scope.resolver.js");

  const prisma = new PrismaService({ getOrThrow: (k: string) => process.env[k] } as never);
  await prisma.$connect();
  const tenantA = id("tenant_a"), tenantB = id("tenant_b");
  const orgA = id("org_a"), orgB = id("org_b");
  const projectA = id("project"); // synthetic association, no project FK on PrometeoDocument
  const repo = new PrometeoRepository(prisma);
  const policy = new PrometeoAccessPolicy(new ResourceScopeResolver(prisma));
  const ownerScope = { orgId: orgA, projectIds: [], jobIds: [] };
  const participantScope = { orgId: orgA, projectIds: [projectA], jobIds: [] };

  try {
    await prisma.tenant.create({ data: { id: tenantA, slug: tenantA, name: "P0 isolation A" } });
    await prisma.tenant.create({ data: { id: tenantB, slug: tenantB, name: "P0 isolation B" } });

    const create = async (tenantId: string, orgId: string, projectId?: string) => {
      const doc = await repo.createDocument({
        tenantId, orgId, projectId, title: id("secret"), sourceType: "text",
        uploadedById: "p0_test_user", metadataJson: { visibility: "tenant_private", trade: "general" },
      });
      await repo.saveChunks(doc.id, tenantId, [{
        index: 0, text: `private document ${doc.id}`, tokenCount: 4,
        embedding: [0, 0], metadata: {},
      }]);
      await repo.markIndexed(doc.id, 1);
      const chunk = await prisma.documentChunk.findFirstOrThrow({ where: { tenantId, documentId: doc.id } });
      return { doc, chunk };
    };

    // B first, then two A documents, then B again: pagination must not truncate A.
    const foreignFirst = await create(tenantA, orgB);
    const own1 = await create(tenantA, orgA);
    const own2 = await create(tenantA, orgA);
    const foreignLast = await create(tenantA, orgB);
    const legacyUnverifiedProject = await create(tenantA, orgB, projectA);
    const ownProject = await create(tenantA, orgA, projectA);
    const crossTenant = await create(tenantB, orgA);

    const list = await repo.listDocuments({ tenantId: tenantA, scope: ownerScope, limit: 2 });
    assert.deepEqual(new Set(list.map(d => d.id)), new Set([own1.doc.id, own2.doc.id]));
    assert.ok(!list.some(d => d.id === foreignFirst.doc.id || d.id === foreignLast.doc.id));

    const ownChunks = await repo.loadChunksForSearch({ tenantId: tenantA, scope: ownerScope });
    assert.deepEqual(new Set(ownChunks.map(c => c.documentId)), new Set([own1.doc.id, own2.doc.id]));
    const projectChunks = await repo.loadChunksForSearch({ tenantId: tenantA, scope: participantScope });
    assert.ok(projectChunks.some(c => c.documentId === ownProject.doc.id));
    assert.ok(!projectChunks.some(c => c.documentId === legacyUnverifiedProject.doc.id),
      "historical projectId without a verified grant must not expose another org's document");
    assert.ok(!projectChunks.some(c => c.documentId === foreignLast.doc.id));
    assert.ok(!projectChunks.some(c => c.documentId === crossTenant.doc.id));

    // Grant revocation is enforced directly by the parent relation during
    // chunk retrieval, not by a potentially stale prior list of document IDs.
    const transientGrant = await prisma.prometeoDocumentGrant.create({ data: {
      tenantId: tenantA, documentId: legacyUnverifiedProject.doc.id, projectId: projectA,
      recipientOrgId: orgA, grantedByUserId: "p0_test_user",
    } });
    const sharedBeforeRevoke = await repo.loadChunksForSearch({ tenantId: tenantA, scope: participantScope });
    assert.ok(sharedBeforeRevoke.some(c => c.documentId === legacyUnverifiedProject.doc.id),
      "an active explicit grant makes the indexed document readable at its authorized scope");
    await prisma.prometeoDocumentGrant.update({
      where: { id: transientGrant.id },
      data: { revokedAt: new Date(), revokedByUserId: "p0_test_user" },
    });
    const sharedAfterRevoke = await repo.loadChunksForSearch({ tenantId: tenantA, scope: participantScope });
    assert.ok(!sharedAfterRevoke.some(c => c.documentId === legacyUnverifiedProject.doc.id),
      "revoked grants must never select document text on a fresh chunk SQL query");

    await repo.saveFeedback({
      tenantId: tenantA, chunkId: own1.chunk.id, documentId: own1.doc.id,
      userId: "p0_actor", type: "confirm",
    });
    await repo.saveFeedback({
      tenantId: tenantA, chunkId: foreignLast.chunk.id, documentId: foreignLast.doc.id,
      userId: "p0_actor", type: "flag",
    });
    const stats = await repo.getFeedbackStats(tenantA, ownerScope);
    assert.equal(stats.totalFeedback, 1);
    assert.deepEqual(stats.byType, { confirm: 1 });
    assert.ok(stats.topDocuments.every(entry => entry.documentId !== foreignLast.doc.id));

    const actorA = { tenantId: tenantA, orgId: orgA, userId: "p0_actor", roles: ["CLIENT"] };
    const otherTenantActor = { ...actorA, tenantId: tenantB };
    await assert.rejects(
      () => policy.assertRowAccess(actorA as never, foreignLast.doc, "Not found"),
      (err: any) => err.getStatus?.() === 403,
    );
    await assert.rejects(
      () => policy.assertRowAccess(otherTenantActor as never, own1.doc, "Not found"),
      (err: any) => err.getStatus?.() === 404,
    );
    await assert.rejects(
      () => repo.deleteDocument({ tenantId: tenantB, id: own1.doc.id }),
      (err: any) => err.getStatus?.() === 404,
    );
    assert.ok(await repo.getDocument(own1.doc.id), "foreign-tenant delete must not alter the document");

    // Composite FK forbids cross-tenant and cross-project grants at the database boundary.
    for (const mismatch of [
      { tenantId: tenantB, projectId: projectA },
      { tenantId: tenantA, projectId: id("unrelated_project") },
    ]) {
      await assert.rejects(() => prisma.prometeoDocumentGrant.create({ data: {
        ...mismatch, documentId: ownProject.doc.id, recipientOrgId: orgB,
        grantedByUserId: "p0_test_user",
      } }), "a forged grant must not reference a different document tenant/project");
    }

    const bindingGrant = await prisma.prometeoDocumentGrant.create({ data: {
      tenantId: tenantA, documentId: ownProject.doc.id, projectId: projectA,
      recipientOrgId: orgB, grantedByUserId: "p0_test_user",
    } });
    await assert.rejects(() => prisma.prometeoDocument.update({
      where: { id: ownProject.doc.id }, data: { projectId: id("reassigned_project") },
    }), "a shared document cannot silently shift its grant to a new project");
    await prisma.prometeoDocumentGrant.delete({ where: { id: bindingGrant.id } });

    // A cascaded share must leave an immutable audit trail; failed audit FK must roll back document deletion.
    const deleting = await create(tenantA, orgA, projectA);
    const grant = await prisma.prometeoDocumentGrant.create({ data: {
      tenantId: tenantA, documentId: deleting.doc.id, projectId: projectA,
      recipientOrgId: orgB, grantedByUserId: "p0_test_user",
    } });
    await assert.rejects(() => repo.deleteDocument({
      tenantId: tenantA, id: deleting.doc.id, orgId: orgA,
      actorUserId: id("nonexistent_actor"), requestId: "failed-audit",
    }));
    assert.ok(await repo.getDocument(deleting.doc.id), "an audit write failure must roll back deletion");
    assert.ok(await prisma.prometeoDocumentGrant.findUnique({ where: { id: grant.id } }),
      "failed audit must retain shares and the document");

    await repo.deleteDocument({ tenantId: tenantA, id: deleting.doc.id, orgId: orgA, requestId: "valid-delete" });
    assert.equal(await repo.getDocument(deleting.doc.id), null);
    assert.equal(await prisma.prometeoDocumentGrant.findUnique({ where: { id: grant.id } }), null);
    const recorded = await prisma.auditLog.findMany({
      where: { tenantId: tenantA, OR: [{ entityId: deleting.doc.id }, { entityId: grant.id }] },
      select: { entityId: true, action: true },
    });
    assert.deepEqual(new Set(recorded.map(entry => entry.action)),
      new Set(["prometeo.document_deleted", "prometeo.document_share_revoked_by_delete"]));

    // Two synchronized owner requests must produce a single deletion/audit set.
    const competing = await create(tenantA, orgA, projectA);
    const competingGrant = await prisma.prometeoDocumentGrant.create({ data: {
      tenantId: tenantA, documentId: competing.doc.id, projectId: projectA,
      recipientOrgId: orgB, grantedByUserId: "p0_test_user",
    } });
    let release!: () => void;
    const startGate = new Promise<void>(resolve => { release = resolve; });
    const twoDeletes = [0, 1].map(async (attempt) => {
      await startGate;
      return repo.deleteDocument({
        tenantId: tenantA, id: competing.doc.id, orgId: orgA,
        requestId: `concurrent-${attempt}`,
      });
    });
    release();
    const outcomes = await Promise.allSettled(twoDeletes);
    assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1,
      "exactly one concurrent deletion may commit");
    const denied = outcomes.find(result => result.status === "rejected");
    assert.ok(denied && denied.status === "rejected");
    assert.equal((denied as PromiseRejectedResult).reason?.getStatus?.(), 404,
      "losing concurrent delete must return stable 404, not a serialization 500");
    const concurrentAudit = await prisma.auditLog.findMany({
      where: { tenantId: tenantA, OR: [{ entityId: competing.doc.id }, { entityId: competingGrant.id }] },
      select: { action: true },
    });
    assert.deepEqual(concurrentAudit.map(record => record.action).sort(),
      ["prometeo.document_deleted", "prometeo.document_share_revoked_by_delete"].sort(),
      "audits must be written exactly once even with racing delete requests");
  } finally {
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await prisma.$disconnect();
  }
});
