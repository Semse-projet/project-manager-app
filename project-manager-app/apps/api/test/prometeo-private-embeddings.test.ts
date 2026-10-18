import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { EmbeddingService, isZeroVector } from "../dist/modules/prometeo/embedding.service.js";
import { PrometeoService } from "../dist/modules/prometeo/prometeo.service.js";

test("private embedding and private query never call OpenAI even with a valid cloud key", async () => {
  const priorKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  let outgoingCalls = 0;
  try {
    process.env.OPENAI_API_KEY = "sk-test-this-key-is-not-a-real-credential";
    globalThis.fetch = async () => {
      outgoingCalls++;
      throw new Error("PRIVATE EMBEDDING LEAK DETECTED");
    };
    const embeddings = new EmbeddingService();
    assert.equal(embeddings.isAvailable, true, "test simulates cloud credentials being configured");
    const vectors = await embeddings.embedBatch(["PRIVATE DOCUMENT SECRET", "PRIVATE CUSTOMER EVIDENCE"], { localOnly: true });
    assert.equal(vectors.length, 2);
    assert.ok(vectors.every(isZeroVector), "local FTS fallback must be a zero vector");
    const queryVec = await embeddings.embed("PRIVATE OWNER QUESTION", { localOnly: true });
    assert.ok(isZeroVector(queryVec));
    assert.equal(outgoingCalls, 0, "no private content should reach the external HTTP transport");
  } finally {
    globalThis.fetch = previousFetch;
    if (priorKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = priorKey;
  }
});

test("Prometeo ingestion requires local-only embeddings even for private file chunks", async () => {
  const calls: Array<{ texts: string[]; options: Record<string, unknown> }> = [];
  let release!: () => void;
  const completed = new Promise<void>((resolve) => { release = resolve; });
  const repo = {
    async createDocument() { return { id: "doc-A", status: "parsing" }; },
    async saveChunks() {},
    async markIndexed() { release(); },
    async markFailed(_id: string, msg: string) { throw new Error(msg); },
  };
  const chunker = { chunk() { return [{ index: 0, text: "PRIVATE FILE CONTENT", tokenCount: 3, metadata: {} }]; } };
  const embeddings = {
    isAvailable: true,
    async embedBatch(texts: string[], options: Record<string, unknown>) {
      calls.push({ texts, options });
      return texts.map(() => new Array(1536).fill(0));
    },
  };
  const svc = new PrometeoService(repo as never, chunker as never, embeddings as never, {} as never);
  await svc.ingestText({ tenantId: "tenant-A", orgId: "org-A", userId: "user-A", title: "private", text: "PRIVATE FILE CONTENT" });
  await completed;
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].options, { localOnly: true });
  assert.equal(calls[0].texts[0], "PRIVATE FILE CONTENT");
});

test("private scoped search uses local-only query embeddings and still supports local text ranking", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const repo = {
    async loadChunksForSearch() {
      return [{ id: "chunk-A", tenantId: "tenant-A", documentId: "doc-A", chunkIndex: 0,
        text: "electrical breaker inspection", embeddingJson: [], metadataJson: { trade: "electrical" } }];
    },
    async getFeedbackScores() { return new Map(); },
    async getDocumentTitles() { return new Map([["doc-A", "Private manual"]]); },
  };
  const embeddings = {
    async embed(query: string, options: Record<string, unknown>) {
      calls.push({ query, options }); return new Array(1536).fill(0);
    },
  };
  const svc = new PrometeoService(repo as never, {} as never, embeddings as never, {} as never);
  const results = await svc.search({
    tenantId: "tenant-A", query: "electrical breaker", scope: { orgId: "org-A", projectIds: [], jobIds: [] },
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].options, { localOnly: true });
  assert.equal(results[0]?.documentId, "doc-A");
  assert.equal(results[0]?.retrievalMode, "fts_fallback");
});

test("private document backfill cannot send chunks to OpenAI even when it reports available", async () => {
  const calls: Array<Record<string, unknown>> = [];
  let persisted = false;
  const repo = {
    async listDocuments() { return [{ id: "doc-A", status: "indexed" }]; },
    async loadChunksForSearch() {
      return [{ id: "chunk-A", documentId: "doc-A", chunkIndex: 0, text: "PRIVATE DATA", embeddingJson: [] }];
    },
    async updateChunkEmbedding() { persisted = true; },
  };
  const embeddings = {
    getStats() { return { available: true, provider: "openai" }; },
    async embedBatch(texts: string[], options: Record<string, unknown>) {
      calls.push({ texts, options }); return texts.map(() => new Array(1536).fill(0));
    },
  };
  const svc = new PrometeoService(repo as never, {} as never, embeddings as never, {} as never);
  const result = await svc.backfillEmbeddings({ tenantId: "tenant-A", dryRun: false });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].options, { localOnly: true });
  assert.equal(result.embedded, 0);
  assert.equal(result.failed, 1);
  assert.equal(persisted, false);
});
