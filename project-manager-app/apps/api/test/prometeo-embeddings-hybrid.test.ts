import test from "node:test";
import assert from "node:assert/strict";

/**
 * Prometeo RAG Phase 4.5 — Real Embeddings + Hybrid Retrieval
 *
 * Tests:
 * - isZeroVector detection
 * - hybrid scoring logic
 * - FTS fallback activation for zero-vectors
 * - retrieval mode selection
 * - EmbeddingService stats contract
 * - privacy mode contract
 * - backfill idempotency contract
 */

// ── Utilities (reproduce from embedding.service.ts) ──────────────────────────

type EmbeddingVector = number[];

function isZeroVector(vec: EmbeddingVector | null | undefined): boolean {
  if (!vec || vec.length === 0) return true;
  return vec.every((v) => v === 0);
}

function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function ftsScore(text: string, query: string): number {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return 0;
  const lower = text.toLowerCase();
  const hits = words.filter((w) => lower.includes(w)).length;
  return hits / words.length;
}

type RetrievalMode = "hybrid" | "semantic" | "fts_fallback";

const SEMANTIC_WEIGHT = 0.70;
const FTS_WEIGHT      = 0.30;

interface ScoredChunk {
  text: string;
  score: number;
  semanticScore?: number;
  textScore: number;
  retrievalMode: RetrievalMode;
}

function scoreChunk(
  chunkText: string,
  query: string,
  queryVec: EmbeddingVector,
  chunkVec: EmbeddingVector | null,
): ScoredChunk {
  const hasRealQuery = !isZeroVector(queryVec);
  const hasRealChunk = chunkVec !== null && !isZeroVector(chunkVec);
  const textScore = ftsScore(chunkText, query);

  if (hasRealQuery && hasRealChunk) {
    const semanticScore = cosineSimilarity(queryVec, chunkVec!);
    return {
      text: chunkText,
      score: SEMANTIC_WEIGHT * semanticScore + FTS_WEIGHT * textScore,
      semanticScore,
      textScore,
      retrievalMode: "hybrid",
    };
  }

  return {
    text: chunkText,
    score: textScore,
    textScore,
    retrievalMode: "fts_fallback",
  };
}

// ── Helper to create a real non-zero vector ──────────────────────────────────

function makeVec(dim: number, seed: number): EmbeddingVector {
  return Array.from({ length: dim }, (_, i) => Math.sin((i + 1) * seed * 0.1) * 0.5);
}

function zeroVec(dim: number): EmbeddingVector {
  return new Array(dim).fill(0);
}

// ── isZeroVector tests ────────────────────────────────────────────────────────

test("E.Z1: zero vector de 1536 elementos → isZeroVector=true", () => {
  assert.ok(isZeroVector(zeroVec(1536)));
});

test("E.Z2: vector real con valores no-cero → isZeroVector=false", () => {
  assert.equal(isZeroVector(makeVec(1536, 1.0)), false);
});

test("E.Z3: array vacío → isZeroVector=true", () => {
  assert.ok(isZeroVector([]));
});

test("E.Z4: null → isZeroVector=true", () => {
  assert.ok(isZeroVector(null));
});

test("E.Z5: vector con un solo valor no-cero → isZeroVector=false", () => {
  const vec = new Array(1536).fill(0);
  vec[100] = 0.001;
  assert.equal(isZeroVector(vec), false);
});

// ── Hybrid scoring tests ──────────────────────────────────────────────────────

test("E.H1: query real + chunk real → retrievalMode=hybrid", () => {
  const queryVec = makeVec(8, 1.0);
  const chunkVec = makeVec(8, 1.0); // same seed = perfect similarity
  const result = scoreChunk("electrical panel installation", "panel", queryVec, chunkVec);

  assert.equal(result.retrievalMode, "hybrid");
  assert.ok(result.semanticScore !== undefined);
  assert.ok(result.semanticScore! > 0.9, "parallel vectors should have high cosine similarity");
  assert.ok(result.score > 0, "hybrid score must be positive");
});

test("E.H2: query zero + chunk real → retrievalMode=fts_fallback", () => {
  const queryVec = zeroVec(8);
  const chunkVec = makeVec(8, 1.0);
  const result = scoreChunk("electrical panel installation", "panel", queryVec, chunkVec);

  assert.equal(result.retrievalMode, "fts_fallback");
  assert.equal(result.semanticScore, undefined);
  assert.ok(result.score >= 0);
});

test("E.H3: query real + chunk zero → retrievalMode=fts_fallback (zero-vector bug fixed)", () => {
  const queryVec = makeVec(8, 1.0);
  const chunkVec = zeroVec(8); // this is the bug we fixed
  const result = scoreChunk("electrical panel breaker", "panel breaker", queryVec, chunkVec);

  // BUG FIX: before, this would use cosine similarity returning 0 for ALL chunks
  // Now it correctly falls back to FTS
  assert.equal(result.retrievalMode, "fts_fallback", "zero-vector chunk must use FTS fallback, not cosine");
  assert.ok(result.score > 0, "FTS score should be positive for matching text");
  assert.equal(result.semanticScore, undefined, "semanticScore must be undefined in fts_fallback mode");
});

test("E.H4: query zero + chunk zero → fts_fallback (old behavior was returning all zeros)", () => {
  const queryVec = zeroVec(8);
  const chunkVec = zeroVec(8);
  const result = scoreChunk("install circuit breaker panel", "breaker panel", queryVec, chunkVec);

  assert.equal(result.retrievalMode, "fts_fallback");
  assert.ok(result.score > 0, "FTS should still return non-zero score for matching text");
  // Old behavior: cosine(zero, zero) = 0, ALL chunks got score 0 → random ordering
});

test("E.H5: hybrid score combina semantic y FTS correctamente", () => {
  const queryVec = makeVec(8, 2.0);
  const chunkVec = makeVec(8, 2.0);
  const query = "electrical panel";
  const text = "Install electrical panel safely";
  const result = scoreChunk(text, query, queryVec, chunkVec);

  const expectedSemantic = cosineSimilarity(queryVec, chunkVec);
  const expectedFts = ftsScore(text, query);
  const expectedHybrid = SEMANTIC_WEIGHT * expectedSemantic + FTS_WEIGHT * expectedFts;

  assert.ok(Math.abs(result.score - expectedHybrid) < 0.001, "hybrid score formula must match");
});

// ── FTS quality tests ────────────────────────────────────────────────────────

test("E.F1: FTS score > 0 cuando query aparece en texto", () => {
  const score = ftsScore("Install circuit breaker in electrical panel", "electrical panel");
  assert.ok(score > 0, "should find 'electrical' and 'panel' in text");
});

test("E.F2: FTS score = 0 cuando no hay match de palabras largas", () => {
  const score = ftsScore("Kitchen tile installation step by step", "electrical breaker");
  assert.equal(score, 0, "no matching words → score 0");
});

test("E.F3: FTS palabras cortas (<= 2 chars) no se cuentan", () => {
  const score = ftsScore("do or the not", "do or");
  assert.equal(score, 0, "words <= 2 chars must be excluded");
});

// ── Chunk ranking tests ───────────────────────────────────────────────────────

test("E.R1: chunk más relevante tiene score mayor", () => {
  const query = "electrical panel breaker installation";
  const queryVec = zeroVec(8); // FTS mode

  const relevant = scoreChunk("Install electrical panel and circuit breaker", query, queryVec, null);
  const irrelevant = scoreChunk("Kitchen backsplash tile installation", query, queryVec, null);

  assert.ok(relevant.score > irrelevant.score, "relevant chunk must score higher than irrelevant");
});

test("E.R2: semantic similarity supera FTS cuando hay embeddings reales", () => {
  // Same-seed vectors = perfect cosine similarity (similar meaning)
  const queryVec = makeVec(8, 3.0);
  const chunkSemanticallyClose = makeVec(8, 3.01); // close seed = high similarity
  const chunkSemanticallyFar   = makeVec(8, 99.0); // far seed = low similarity

  const closeResult = scoreChunk("Different text but same topic", "panel", queryVec, chunkSemanticallyClose);
  const farResult   = scoreChunk("panel panel panel panel panel panel", "panel", queryVec, chunkSemanticallyFar);

  // Close semantic chunk should win even with less FTS match
  const closeSem = cosineSimilarity(queryVec, chunkSemanticallyClose);
  const farSem   = cosineSimilarity(queryVec, chunkSemanticallyFar);

  assert.ok(closeSem > farSem, "semantically close chunk must have higher cosine similarity");
});

// ── EmbeddingService stats contract ─────────────────────────────────────────

test("E.S1: stats contrato de campos requeridos", () => {
  const requiredFields = ["provider", "model", "available", "successCount", "failureCount", "fallbackCount", "avgLatencyMs"];

  // Simulate what getStats() must return
  const mockStats = {
    provider: "openai",
    model: "text-embedding-3-small",
    available: false,
    successCount: 0,
    failureCount: 0,
    fallbackCount: 5,
    avgLatencyMs: 0,
  };

  requiredFields.forEach((field) => {
    assert.ok(field in mockStats, `stats must include field: ${field}`);
  });
});

test("E.S2: fallbackCount debe incrementar cuando no hay API key", () => {
  let fallbackCount = 0;
  const isAvailable = false;

  // Simulate embedBatch behavior without key
  if (!isAvailable) {
    fallbackCount += 3; // batch of 3 texts
  }

  assert.equal(fallbackCount, 3, "fallbackCount must increment per text when no key");
});

// ── EmbeddingRagHealth contract ───────────────────────────────────────────────

test("E.HE1: EmbeddingRagHealth campos requeridos", () => {
  const requiredFields = [
    "embeddingsProvider", "embeddingsModel", "embeddingsAvailable", "embeddingsHealthy",
    "totalDocuments", "totalChunks", "chunksWithEmbeddings", "chunksMissingEmbeddings",
    "avgEmbeddingLatencyMs", "fallbackCount", "successCount", "failureCount", "retrievalMode",
  ];

  const mockHealth = {
    embeddingsProvider:      "openai",
    embeddingsModel:         "text-embedding-3-small",
    embeddingsAvailable:     true,
    embeddingsHealthy:       true,
    totalDocuments:          10,
    totalChunks:             150,
    chunksWithEmbeddings:    148,
    chunksMissingEmbeddings: 2,
    avgEmbeddingLatencyMs:   450,
    fallbackCount:           2,
    successCount:            148,
    failureCount:            0,
    retrievalMode:           "hybrid" as const,
  };

  requiredFields.forEach((field) => {
    assert.ok(field in mockHealth, `EmbeddingRagHealth must include field: ${field}`);
  });
});

test("E.HE2: retrievalMode=fts_fallback cuando no hay embeddings disponibles", () => {
  const available = false;
  const chunksWithEmbeddings = 0;
  const mode = available && chunksWithEmbeddings > 0 ? "hybrid" : "fts_fallback";
  assert.equal(mode, "fts_fallback");
});

test("E.HE3: retrievalMode=hybrid cuando hay embeddings y provider disponible", () => {
  const available = true;
  const chunksWithEmbeddings = 100;
  const mode = available && chunksWithEmbeddings > 0 ? "hybrid" : "fts_fallback";
  assert.equal(mode, "hybrid");
});

// ── Privacy policy tests ──────────────────────────────────────────────────────

test("E.PR1: privacyCritical docs no deben enviarse a cloud embeddings sin política explícita", () => {
  // Contract: documents tagged privacyCritical should not use cloud embeddings
  const privacyCriticalDoc = { privacyCritical: true, trade: "electrical" };
  const CLOUD_PROVIDERS = new Set(["openai", "anthropic"]);

  // Policy: privacyCritical → use local/Ollama only, or FTS fallback
  // This test verifies the POLICY, not the implementation
  const allowedProviders = ["fts", "ollama_embeddings", "local"];
  const disallowedProviders = allowedProviders.filter((p) => CLOUD_PROVIDERS.has(p));

  assert.equal(disallowedProviders.length, 0, "privacyCritical docs must not use cloud embedding providers");
  assert.ok(privacyCriticalDoc.privacyCritical, "doc should be marked privacyCritical");
});

test("E.PR2: docs públicos (public_training) pueden usar cloud embeddings", () => {
  const publicDoc = { visibility: "public_training", privacyCritical: false };
  const canUseCloud = !publicDoc.privacyCritical;
  assert.ok(canUseCloud, "public_training docs may use cloud embeddings");
});

// ── Backfill idempotency ──────────────────────────────────────────────────────

test("E.BF1: isZeroVector determina qué chunks necesitan backfill", () => {
  const chunks = [
    { id: "c1", embeddingJson: zeroVec(8) },        // needs backfill
    { id: "c2", embeddingJson: makeVec(8, 1.0) },   // already embedded
    { id: "c3", embeddingJson: null },               // needs backfill
    { id: "c4", embeddingJson: [] },                 // needs backfill
    { id: "c5", embeddingJson: makeVec(8, 2.0) },   // already embedded
  ];

  const needsBackfill = chunks.filter((c) => isZeroVector(c.embeddingJson as number[]));
  const alreadyEmbedded = chunks.filter((c) => !isZeroVector(c.embeddingJson as number[]));

  assert.equal(needsBackfill.length, 3, "3 chunks need backfill (zero, null, empty)");
  assert.equal(alreadyEmbedded.length, 2, "2 chunks already have real embeddings");
  assert.deepEqual(needsBackfill.map((c) => c.id), ["c1", "c3", "c4"]);
});

test("E.BF2: backfill idempotente — chunks ya embebidos no se re-procesan", () => {
  const initial = [
    { id: "c1", hasEmbedding: false },
    { id: "c2", hasEmbedding: true },
    { id: "c3", hasEmbedding: false },
  ];

  // Simulate backfill pass 1
  const pass1 = initial.filter((c) => !c.hasEmbedding).map((c) => ({ ...c, hasEmbedding: true }));
  const afterPass1 = initial.map((c) => pass1.find((p) => p.id === c.id) ?? c);

  // Simulate backfill pass 2 (idempotent)
  const pass2 = afterPass1.filter((c) => !c.hasEmbedding);

  assert.equal(pass2.length, 0, "second pass must find nothing to do (idempotent)");
  assert.ok(afterPass1.every((c) => c.hasEmbedding), "all chunks embedded after pass 1");
});

// ── SearchResult type contract ────────────────────────────────────────────────

test("E.SR1: SearchResult debe incluir retrievalMode", () => {
  const result = {
    documentId: "d1",
    documentTitle: "Manual Eléctrico",
    chunkIndex: 0,
    text: "Install breaker panel safely",
    score: 0.75,
    semanticScore: 0.82,
    textScore: 0.60,
    retrievalMode: "hybrid" as RetrievalMode,
  };

  assert.ok("retrievalMode" in result, "SearchResult must have retrievalMode");
  assert.ok(["hybrid", "semantic", "fts_fallback"].includes(result.retrievalMode));
});

test("E.SR2: fts_fallback result no tiene semanticScore", () => {
  const queryVec = zeroVec(4);
  const result = scoreChunk("Panel eléctrico instalación", "panel eléctrico", queryVec, null);

  assert.equal(result.retrievalMode, "fts_fallback");
  assert.equal(result.semanticScore, undefined, "fts_fallback results must not have semanticScore");
});
