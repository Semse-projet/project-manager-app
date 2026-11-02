/**
 * P0 #974 / P1 #992 — ephemeral PostgreSQL regression for historical raw RAG.
 * Covers SQL-scoped search, titles, derived context, citations, counts and
 * revocation. Synthetic fixtures only; this does NOT replace signed HTTP
 * A/B/C tests, outbox replay, a real egress capture or operational rollback.
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

// Refuse production, Railway and arbitrary developer databases unconditionally.
// Same allowlist as the existing P0 physical-PostgreSQL regression tests.
const databaseUrl = process.env.DATABASE_URL;
const target = databaseUrl ? new URL(databaseUrl) : null;
const databaseName = target?.pathname.slice(1) ?? "";
const inGitHubDisposablePg = process.env.GITHUB_ACTIONS === "true" &&
  process.env.CI === "true" &&
  target?.hostname === "127.0.0.1" &&
  target?.port === "5433" &&
  databaseName === "semse";
const optedInLocalPg = process.env.SEMSE_PROMETEO_ISOLATED_DB_TEST === "1" &&
  ["127.0.0.1", "localhost"].includes(target?.hostname ?? "") &&
  /^semse_(?:test|qa|p0)(?:_|$)/.test(databaseName);
if (databaseUrl && !inGitHubDisposablePg && !optedInLocalPg) {
  throw new Error("Legacy RAG security regression refuses a non-isolated database");
}
const pgTest = databaseUrl ? test : test.skip;
const id = (name: string) =>
  `legacy_rag_${name}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

pgTest("legacy PROMOTED/public_training stays private in search, RAG, titles, citations and counts", async () => {
  const oldSharing = process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED;
  // CI/QA fixture only: exercise both grant-on and flag-off paths.
  process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED = "true";
  try {

  const { PrismaService } = await import("../dist/infrastructure/prisma/prisma.service.js");
  const { PrometeoRepository } = await import("../dist/modules/prometeo/prometeo.repository.js");
  const { PrometeoService } = await import("../dist/modules/prometeo/prometeo.service.js");

  const prisma = new PrismaService({ getOrThrow: (key: string) => process.env[key] } as never);
  const repo = new PrometeoRepository(prisma);
  // A deliberately inert LOCAL embedding provider: no network calls or secrets.
  const embedding = {
    async embed(_query: string, options?: { localOnly?: boolean }) {
      assert.equal(options?.localOnly, true);
      return [];
    },
  };
  const svc = new PrometeoService(repo, {} as never, embedding as never, {} as never);
  const tenantAB = id("tenant_ab"), tenantC = id("tenant_c");
  const orgA = id("owner_a"), orgB = id("reader_b"), orgC = id("reader_c");
  const project = id("project");
  const scopeA = { orgId: orgA, projectIds: [project], jobIds: [] };
  const scopeB = { orgId: orgB, projectIds: [project], jobIds: [] };
  const scopeC = { orgId: orgC, projectIds: [], jobIds: [] };
  const query = "breaker";
  const privateTitle = id("owner_private_title");
  const privateToken = id("owner_private_chunk");
  const foreignTitle = id("cross_tenant_title");
  const foreignToken = id("cross_tenant_chunk");

  let databaseConnected = false;
  let primaryFailure: unknown;
  let hasPrimaryFailure = false;
  try {
    await prisma.$connect();
    databaseConnected = true;
    for (const [tenantId, label] of [[tenantAB, "AB"], [tenantC, "C"]] as const) {
      await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, name: `Synthetic RAG ${label}` } });
    }

    const create = async (tenantId: string, orgId: string, title: string, token: string, projectId?: string) => {
      const document = await repo.createDocument({
        tenantId, orgId, projectId, title, uploadedById: "legacy_rag_test_actor",
        sourceType: "field_observation", sourceRef: id("synthetic_observation"),
        metadataJson: { visibility: "public_training", promotionStatus: "PROMOTED", trade: "electrical" },
      });
      await repo.saveChunks(document.id, tenantId, [{
        index: 0, text: `breaker synthetic ${token}`, tokenCount: 4, embedding: [],
        metadata: { trade: "electrical" },
      }]);
      await repo.markIndexed(document.id, 1);
      return document.id;
    };

    const original = await create(tenantAB, orgA, privateTitle, privateToken);
    const ownB = await create(tenantAB, orgB, id("reader_b_title"), id("reader_b_chunk"));
    const tenantCOriginal = await create(tenantC, orgC, foreignTitle, foreignToken);
    const linkedOriginal = await create(tenantAB, orgA, id("project_owner_title"), id("project_owner_chunk"), project);
    const linkedActive = await create(tenantAB, orgA, id("project_active_title"), id("project_active_chunk"), project);

    const verify = async (
      tenantId: string,
      scope: { orgId: string; projectIds: string[]; jobIds: string[] },
      forbiddenIds: string[],
      forbiddenStrings: string[],
    ) => {
      const list = await repo.listDocuments({ tenantId, scope });
      const results = await svc.search({ tenantId, scope, query, topK: 20 });
      const rag = await svc.buildRagContext({ tenantId, scope, query, topK: 20 });
      const retrieved = await svc.retrieveContext({ tenantId, scope, query, topK: 20 });
      const library = await svc.getTradeLibrary(tenantId, scope);
      const feedback = await svc.getFeedbackStats(tenantId, scope);
      const published = JSON.stringify({ list, results, rag, retrieved, library, feedback });
      for (const forbiddenId of forbiddenIds) {
        assert.ok(!list.some(row => row.id === forbiddenId), "foreign document is not listed");
        assert.ok(!results.some(row => row.documentId === forbiddenId), "foreign document is not searched");
        assert.ok(!retrieved.citations.some(row => row.documentId === forbiddenId), "foreign document is not cited");
      }
      for (const forbidden of forbiddenStrings) {
        assert.ok(!published.includes(forbidden), "private title/text never appears in any result");
      }
      const electrical = library.find(row => row.trade === "electrical");
      assert.ok(electrical, "electrical counters must exist");
      return { list, results, rag, retrieved, library, feedback, electrical };
    };

    const beforeB = await verify(
      tenantAB, scopeB, [original, linkedOriginal, linkedActive, tenantCOriginal],
      [privateTitle, privateToken, foreignTitle, foreignToken],
    );
    assert.deepEqual(
      [beforeB.electrical.documentsCount, beforeB.electrical.indexedCount, beforeB.electrical.chunksCount],
      [1, 1, 1], "Org B must not count two private project docs or a private original",
    );
    assert.ok(beforeB.results.some(row => row.documentId === ownB), "owner B retains its own search");
    assert.ok(beforeB.retrieved.citations.some(row => row.documentId === ownB), "owner B retains its own citations");
    assert.ok(!beforeB.rag.contextBlock.includes(privateToken), "private original excluded from RAG prompt");
    const seenByA = await verify(tenantAB, scopeA, [ownB, tenantCOriginal], [foreignTitle, foreignToken]);
    assert.deepEqual(
      [seenByA.electrical.documentsCount, seenByA.electrical.indexedCount, seenByA.electrical.chunksCount],
      [3, 3, 3], "Org A sees its original and both own project documents only",
    );
    assert.ok(seenByA.results.some(row => row.documentId === original), "owner A retains private original");
    assert.ok(seenByA.retrieved.citations.some(row => row.documentId === original), "owner A cites its own original");
    const seenByC = await verify(tenantC, scopeC, [original, ownB, linkedOriginal], [privateTitle, privateToken]);
    assert.ok(seenByC.results.some(row => row.documentId === tenantCOriginal), "tenant C reads only its own content");
    assert.deepEqual(
      [seenByC.electrical.documentsCount, seenByC.electrical.indexedCount, seenByC.electrical.chunksCount],
      [1, 1, 1], "tenant C must not include any AB document in counts",
    );

    // Feedback metadata must not leak into another organization's count or top documents.
    await repo.saveFeedback({
      tenantId: tenantAB, documentId: original,
      chunkId: (await prisma.documentChunk.findFirstOrThrow({ where: { tenantId: tenantAB, documentId: original } })).id,
      userId: "legacy_rag_test_actor", type: "confirm",
    });
    assert.equal((await svc.getFeedbackStats(tenantAB, scopeB)).totalFeedback, 0);
    assert.equal((await svc.getFeedbackStats(tenantAB, scopeA)).totalFeedback, 1);

    // An explicit project grant does not publish the unassociated historical original.
    // Direct title queries use the same SQL ACL as chunk retrieval, not a
    // tenant-blind second pass over known or guessed document IDs.
    const candidateIds = [original, linkedOriginal, linkedActive, ownB, tenantCOriginal];
    const titlesBeforeGrant = await repo.getDocumentTitles({
      tenantId: tenantAB, scope: scopeB, docIds: candidateIds,
    });
    assert.deepEqual([...titlesBeforeGrant.keys()], [ownB],
      "known private IDs are not title lookups without permission");
    const missingScopeTitles = await repo.getDocumentTitles({
      tenantId: tenantAB, docIds: candidateIds,
    } as never);
    assert.equal(missingScopeTitles.size, 0,
      "legacy internal title caller without scope must fail closed");
    const opsTitles = await repo.getDocumentTitles({
      tenantId: tenantAB, scope: null, docIds: candidateIds,
    });
    assert.ok(opsTitles.has(original), "explicit OPS_ADMIN scope sentinel may access same-tenant titles");
    assert.ok(opsTitles.has(ownB));
    assert.equal(opsTitles.has(tenantCOriginal), false,
      "even explicit OPS_ADMIN scope must not cross tenants");

    const grant = await prisma.prometeoDocumentGrant.create({ data: {
      tenantId: tenantAB, documentId: linkedOriginal, projectId: project,
      recipientOrgId: orgB, grantedByUserId: "legacy_rag_test_actor",
    } });
    const withGrant = await svc.retrieveContext({ tenantId: tenantAB, scope: scopeB, query, topK: 20 });
    assert.deepEqual(
      [ (await svc.getTradeLibrary(tenantAB, scopeB)).find(row => row.trade === "electrical")?.documentsCount,
        (await svc.getTradeLibrary(tenantAB, scopeB)).find(row => row.trade === "electrical")?.indexedCount,
        (await svc.getTradeLibrary(tenantAB, scopeB)).find(row => row.trade === "electrical")?.chunksCount ],
      [2, 2, 2], "active grant exposes exactly one extra project document, not historical original",
    );
    assert.ok(withGrant.citations.some(row => row.documentId === linkedOriginal));
    assert.ok(!withGrant.citations.some(row => row.documentId === original));
    const titlesWithGrant = await repo.getDocumentTitles({
      tenantId: tenantAB, scope: scopeB, docIds: candidateIds,
    });
    assert.ok(titlesWithGrant.has(ownB));
    assert.ok(titlesWithGrant.has(linkedOriginal), "explicit grant authorizes only the linked project title");
    assert.ok(!titlesWithGrant.has(original), "unassociated legacy original is never grant-visible");
    assert.ok(!titlesWithGrant.has(linkedActive), "another project document needs its own grant");
    assert.ok(!titlesWithGrant.has(tenantCOriginal), "foreign tenant title never crosses boundary");
    await prisma.prometeoDocumentGrant.update({
      where: { id: grant.id }, data: { revokedAt: new Date(), revokedByUserId: "legacy_rag_test_actor" },
    });
    const afterRevoke = await verify(tenantAB, scopeB,
      [original, linkedOriginal, linkedActive, tenantCOriginal],
      [privateTitle, privateToken, foreignTitle, foreignToken]);
    assert.equal(afterRevoke.electrical.documentsCount, 1, "revocation removes the shared document from counts");
    // Simulate a stale list of chunk IDs held from BEFORE revocation.
    const titlesAfterRevoke = await repo.getDocumentTitles({
      tenantId: tenantAB, scope: scopeB, docIds: candidateIds,
    });
    assert.deepEqual([...titlesAfterRevoke.keys()], [ownB],
      "live SQL ACL must not return a title after grant revocation");

    // A SECOND, STILL ACTIVE grant is required to prove the kill switch is
    // effective independently of revocation. Owner access must not change.
    const stillActive = await prisma.prometeoDocumentGrant.create({ data: {
      tenantId: tenantAB, documentId: linkedActive, projectId: project,
      recipientOrgId: orgB, grantedByUserId: "legacy_rag_test_actor",
    } });
    const activeResult = await svc.retrieveContext({ tenantId: tenantAB, scope: scopeB, query, topK: 20 });
    assert.ok(activeResult.citations.some(row => row.documentId === linkedActive),
      "the second grant is active before toggling OFF");
    assert.equal((await svc.getTradeLibrary(tenantAB, scopeB))
      .find(row => row.trade === "electrical")?.documentsCount, 2);

    process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED = "false";
    const sharingOff = await verify(tenantAB, scopeB,
      [original, linkedOriginal, linkedActive, tenantCOriginal],
      [privateTitle, privateToken, foreignTitle, foreignToken]);
    assert.deepEqual(
      [sharingOff.electrical.documentsCount, sharingOff.electrical.indexedCount, sharingOff.electrical.chunksCount],
      [1, 1, 1], "OFF hides a still-active grant from all counters",
    );
    assert.ok((await svc.retrieveContext({ tenantId: tenantAB, scope: scopeA, query })).citations
      .some(row => row.documentId === linkedActive), "owner access is retained while sharing is OFF");
    assert.ok(await prisma.prometeoDocumentGrant.findUnique({ where: { id: stillActive.id } }),
      "OFF does not destroy active grants");
    const titlesOffWithActiveGrant = await repo.getDocumentTitles({
      tenantId: tenantAB, scope: scopeB, docIds: candidateIds,
    });
    assert.deepEqual([...titlesOffWithActiveGrant.keys()], [ownB],
      "OFF suppresses title access even if the explicit project grant is still active");
    process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED = "true";
    assert.ok((await svc.retrieveContext({ tenantId: tenantAB, scope: scopeB, query })).citations
      .some(row => row.documentId === linkedActive), "grant becomes visible if ON again");
    await prisma.prometeoDocumentGrant.update({
      where: { id: stillActive.id }, data: { revokedAt: new Date() },
    });
    assert.ok(!(await svc.retrieveContext({ tenantId: tenantAB, scope: scopeB, query })).citations
      .some(row => row.documentId === linkedActive), "revoked second grant remains denied with ON");

    // An internal agent without a resolved caller scope must fail closed.
    assert.deepEqual(await svc.search({ tenantId: tenantAB, query }), []);
    assert.deepEqual(await svc.buildRagContext({ tenantId: tenantAB, query }),
      { chunks: [], contextBlock: "", tokenEstimate: 0 });
    assert.deepEqual(await svc.retrieveContext({ tenantId: tenantAB, query }),
      { available: false, contextBlock: "", citations: [] });
  } catch (error) {
    // Preserve the primary assertion/setup exception even if teardown fails.
    hasPrimaryFailure = true;
    primaryFailure = error;
  } finally {
    const teardownFailures: unknown[] = [];
    if (databaseConnected) {
      try {
        await prisma.tenant.deleteMany({ where: { id: { in: [tenantAB, tenantC] } } });
      } catch (error) {
        teardownFailures.push(error);
      }
    }
    try {
      await prisma.$disconnect();
    } catch (error) {
      teardownFailures.push(error);
    }
    if (teardownFailures.length) {
      throw new AggregateError(
        hasPrimaryFailure ? [primaryFailure, ...teardownFailures] : teardownFailures,
        "Prometeo test or isolated database teardown failed",
      );
    }
  }
  if (hasPrimaryFailure) throw primaryFailure;
  } finally {
    // Also covers failed imports, constructor calls and connection attempts.
    if (oldSharing === undefined) delete process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED;
    else process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED = oldSharing;
  }
});
