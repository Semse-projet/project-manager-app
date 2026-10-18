import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { PrometeoRepository } from "../dist/modules/prometeo/prometeo.repository.js";
import { PrometeoController } from "../dist/modules/prometeo/prometeo.controller.js";
import { PrometeoService } from "../dist/modules/prometeo/prometeo.service.js";

const scope = { orgId: "org-A", projectIds: ["project-A"], jobIds: [] };

test("document listing constrains organization and authorized projects before take", async () => {
  let where: Record<string, unknown> | undefined;
  let take: number | undefined;
  const prisma = {
    prometeoDocument: {
      async findMany(args: { where: Record<string, unknown>; take?: number }) {
        where = args.where; take = args.take; return [];
      },
    },
  };
  const repo = new PrometeoRepository(prisma as never);
  await repo.listDocuments({ tenantId: "tenant-A", scope, limit: 10 });
  assert.equal(where?.tenantId, "tenant-A");
  assert.deepEqual(where?.OR, [
    { projectId: null, orgId: "org-A" },
    { projectId: { in: ["project-A"] }, orgId: "org-A" },
  ]);
  assert.equal(take, 10, "filter is in database query, not applied after pagination");
});

test("retrieval selects only chunks whose parent document passed authorization", async () => {
  let documentWhere: Record<string, unknown> | undefined;
  let chunkWhere: Record<string, unknown> | undefined;
  const prisma = {
    prometeoDocument: {
      async findMany(args: { where: Record<string, unknown> }) {
        documentWhere = args.where;
        return [{ id: "doc-own" }];
      },
    },
    documentChunk: {
      async findMany(args: { where: Record<string, unknown> }) {
        chunkWhere = args.where;
        return [{ id: "chunk-own", documentId: "doc-own", chunkIndex: 0, text: "allowed" }];
      },
    },
  };
  const repo = new PrometeoRepository(prisma as never);
  await repo.loadChunksForSearch({ tenantId: "tenant-A", scope });
  assert.equal(documentWhere?.status, "indexed");
  assert.deepEqual(documentWhere?.OR, [
    { projectId: null, orgId: "org-A" },
    { projectId: { in: ["project-A"] }, orgId: "org-A" },
  ]);
  assert.deepEqual(chunkWhere?.documentId, { in: ["doc-own"] });
  assert.equal(chunkWhere?.tenantId, "tenant-A");
});

test("feedback stats exclude all inaccessible document IDs", async () => {
  let feedbackWhere: Record<string, unknown> | undefined;
  const prisma = {
    prometeoDocument: {
      async findMany() { return [{ id: "doc-own" }]; },
    },
    prometeoChunkFeedback: {
      async findMany(args: { where: Record<string, unknown> }) {
        feedbackWhere = args.where;
        return [];
      },
    },
  };
  const repo = new PrometeoRepository(prisma as never);
  const result = await repo.getFeedbackStats("tenant-A", scope);
  assert.deepEqual(feedbackWhere?.documentId, { in: ["doc-own"] });
  assert.equal(result.totalFeedback, 0);
});

test("Prometeo refuses document ingestion before any write when association is unauthorized", async () => {
  let wrote = false;
  const svc = { async ingestText() { wrote = true; return {}; } };
  const access = {
    async assertCanCreate() { throw new Error("project access denied"); },
  };
  const controller = new PrometeoController(svc as never, access as never);
  const req = { headers: {}, authContext: { tenantId: "tenant-A", orgId: "org-A", userId: "actor-A", roles: ["CLIENT"] } };
  await assert.rejects(() => controller.ingest(req as never, { title: "secret", projectId: "project-B", text: "secret" }), /project access denied/);
  assert.equal(wrote, false);
});

test("Prometeo refuses deletion when the document row is unauthorized", async () => {
  let deleted = false;
  const svc = {
    async getDocument() { return { tenantId: "tenant-A", orgId: "org-B", projectId: null }; },
    async deleteDocument() { deleted = true; },
  };
  const access = {
    async assertRowAccess() { throw new Error("row denied"); },
  };
  const controller = new PrometeoController(svc as never, access as never);
  const req = { headers: {}, authContext: { tenantId: "tenant-A", orgId: "org-A", userId: "actor-A", roles: ["CLIENT"] } };
  await assert.rejects(() => controller.deleteDocument(req as never, "doc-B"), /row denied/);
  assert.equal(deleted, false);
});

test("Prometeo refuses RAG retrieval before touching chunks on invalid project", async () => {
  let retrieved = false;
  const svc = { async buildRagContext() { retrieved = true; return { chunks: [] }; } };
  const access = {
    async assertProjectFilter() { throw new Error("project denied"); },
  };
  const controller = new PrometeoController(svc as never, access as never);
  const req = { headers: {}, authContext: { tenantId: "tenant-A", orgId: "org-A", userId: "actor-A", roles: ["CLIENT"] } };
  await assert.rejects(() => controller.ragContext(req as never, { projectId: "project-B", query: "secret" }), /project denied/);
  assert.equal(retrieved, false);
});

test("public_training cannot be re-enabled by legacy metadata or implicit defaults", async () => {
  let wrote = false;
  const svc = { async ingestText() { wrote = true; return {}; } };
  const access = { async assertCanCreate() {} };
  const controller = new PrometeoController(svc as never, access as never);
  const req = { headers: {}, authContext: { tenantId: "tenant-A", orgId: "org-A", userId: "actor-A", roles: ["CLIENT"] } };
  await assert.rejects(
    () => controller.ingest(req as never, { title: "secret", text: "secret", visibility: "public_training" }),
    /Public sharing requires approved explicit consent/,
  );
  assert.equal(wrote, false);
});


test("internal agents cannot retrieve RAG without an explicit resolved scope", async () => {
  let touchedChunks = false;
  let sentEmbedding = false;
  const repo = {
    async loadChunksForSearch() { touchedChunks = true; return []; },
  };
  const embedding = {
    async embed() { sentEmbedding = true; return []; },
  };
  const svc = new PrometeoService(repo as never, {} as never, embedding as never, {} as never);
  const query = { tenantId: "tenant-A", query: "secret" };
  assert.deepEqual(await svc.search(query), []);
  const ctx = await svc.buildRagContext(query);
  assert.deepEqual(ctx, { chunks: [], contextBlock: "", tokenEstimate: 0 });
  const result = await svc.retrieveContext(query);
  assert.equal(result.available, false);
  assert.deepEqual(result.citations, []);
  assert.equal(touchedChunks, false);
  assert.equal(sentEmbedding, false);
});


test("read access to a participant project does not authorize deletion of another organization's document", async () => {
  let deleted = false;
  const svc = {
    async getDocument() { return { tenantId: "tenant-A", orgId: "org-B", projectId: "project-A" }; },
    async deleteDocument() { deleted = true; },
  };
  const access = { async assertRowAccess() {} };
  const controller = new PrometeoController(svc as never, access as never);
  const req = { headers: {}, authContext: { tenantId: "tenant-A", orgId: "org-A", userId: "actor-A", roles: ["CLIENT"] } };
  await assert.rejects(() => controller.deleteDocument(req as never, "doc-B"), /Only the owning organization/);
  assert.equal(deleted, false);
});


test("private visibility must agree with project association", async () => {
  const writes: Record<string, unknown>[] = [];
  const svc = { async ingestText(data: Record<string, unknown>) { writes.push(data); return { id: "own" }; } };
  const access = { async assertCanCreate() {} };
  const controller = new PrometeoController(svc as never, access as never);
  const req = { headers: {}, authContext: { tenantId: "tenant-A", orgId: "org-A", userId: "actor-A", roles: ["CLIENT"] } };
  await assert.rejects(
    () => controller.ingest(req as never, { title: "bad", text: "confidential", projectId: "p1", visibility: "tenant_private" }),
    /Project documents require project_private visibility/,
  );
  await assert.rejects(
    () => controller.ingest(req as never, { title: "bad", text: "confidential", visibility: "project_private" }),
    /project_private requires projectId/,
  );
  assert.equal(writes.length, 0);
  await controller.ingest(req as never, { title: "good", text: "confidential", metadataJson: { visibility: "public_training" } });
  assert.equal((writes[0]?.metadataJson as Record<string, unknown>).visibility, "tenant_private");
});

test("only explicit admin scope sentinel can unlock tenant-wide RAG lookup", async () => {
  let queries = 0;
  const repo = {
    async loadChunksForSearch() { queries++; return []; },
  };
  const embedding = { async embed() { return []; } };
  const svc = new PrometeoService(repo as never, {} as never, embedding as never, {} as never);
  assert.deepEqual(await svc.search({ tenantId: "tenant-A", query: "secret", scope: undefined }), []);
  assert.equal(queries, 0);
  assert.deepEqual(await svc.search({ tenantId: "tenant-A", query: "secret", scope: null }), []);
  assert.equal(queries, 1);
});


test("actors without an owning org see no legacy ownerless document, even if orgId is empty", async () => {
  let where: Record<string, unknown> | undefined;
  const prisma = { prometeoDocument: { async findMany(args: { where: Record<string, unknown> }) { where = args.where; return []; } } };
  const repo = new PrometeoRepository(prisma as never);
  await repo.listDocuments({ tenantId: "tenant-A", scope: { orgId: "", projectIds: [], jobIds: [] } });
  assert.deepEqual(where?.OR, [{ id: "__no_authorized_documents__" }]);
});


test("a project participant cannot modify another org's legacy chunk feedback", async () => {
  let mutated = false;
  const svc = {
    async getChunkById() { return { id: "chunk-B", documentId: "doc-B" }; },
    async getDocument() { return { tenantId: "tenant-A", orgId: "org-B", projectId: "project-A" }; },
    async submitFeedback() { mutated = true; return { id: "feedback" }; },
  };
  const access = { async assertRowAccess() {} };
  const controller = new PrometeoController(svc as never, access as never);
  const actor = { headers: {}, authContext: { tenantId: "tenant-A", orgId: "org-A", userId: "actor-A", roles: ["CLIENT"] } };
  await assert.rejects(
    () => controller.submitFeedback(actor as never, "chunk-B", { type: "confirm" }),
    /Only the owning organization can submit document feedback/,
  );
  assert.equal(mutated, false);
});


test("document deletion is SQL-constrained by tenant and owning org, not only preflight checks", async () => {
  const filters: Array<Record<string, unknown>> = [];
  const prisma = {
    prometeoDocument: {
      async deleteMany({ where }: { where: Record<string, unknown> }) {
        filters.push(where);
        return { count: 0 };
      },
    },
  };
  const repo = new PrometeoRepository(prisma as never);
  await assert.rejects(
    () => repo.deleteDocument({ tenantId: "tenant-A", id: "doc-B", orgId: "org-A" }),
    /not found/,
  );
  assert.deepEqual(filters, [{ tenantId: "tenant-A", id: "doc-B", orgId: "org-A" }]);
});
