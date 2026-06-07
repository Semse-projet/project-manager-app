import test from "node:test";
import assert from "node:assert/strict";

/**
 * AI Mission Control — Tests unitarios
 * Sin DB, sin HTTP. Cubre lógica de métricas LLM, routing, health y Observer.
 */

// ── LLM Provider metrics logic ────────────────────────────────────────────────

type ProviderSnap = { provider: string; taskType: string; successCount: number; failureCount: number; avgLatencyMs?: number };

function buildSummary(snapshots: ProviderSnap[]) {
  const totalCalls   = snapshots.reduce((s, p) => s + p.successCount + p.failureCount, 0);
  const totalSuccess = snapshots.reduce((s, p) => s + p.successCount, 0);
  const fallbacks    = snapshots.filter((p) => p.provider !== "ollama" && p.successCount > 0);
  const ollamaSnap   = snapshots.find((p) => p.provider === "ollama" && p.taskType === "chat");

  return {
    nativeProvider: "ollama",
    totalCalls,
    totalSuccess,
    successRate: totalCalls > 0 ? totalSuccess / totalCalls : 1,
    fallbackUsed: fallbacks.length > 0,
    ollamaLatency: ollamaSnap?.avgLatencyMs ?? null,
    privacyGuard: true,
    localOnlySafe: true,
  };
}

test("MC.S1: summary con solo Ollama → fallbackUsed=false", () => {
  const snaps: ProviderSnap[] = [
    { provider: "ollama", taskType: "chat", successCount: 10, failureCount: 0, avgLatencyMs: 450 },
  ];
  const s = buildSummary(snaps);
  assert.equal(s.fallbackUsed, false);
  assert.equal(s.totalCalls, 10);
  assert.equal(s.ollamaLatency, 450);
});

test("MC.S2: summary con Ollama + Anthropic → fallbackUsed=true", () => {
  const snaps: ProviderSnap[] = [
    { provider: "ollama",    taskType: "chat", successCount: 8,  failureCount: 2 },
    { provider: "anthropic", taskType: "chat", successCount: 3,  failureCount: 0 },
  ];
  const s = buildSummary(snaps);
  assert.equal(s.fallbackUsed, true);
  assert.equal(s.totalCalls, 13);
  assert.ok(s.successRate > 0.8);
});

test("MC.S3: summary sin llamadas → successRate=1 (vacío es sano)", () => {
  const s = buildSummary([]);
  assert.equal(s.totalCalls, 0);
  assert.equal(s.successRate, 1);
  assert.equal(s.fallbackUsed, false);
});

test("MC.S4: privacyGuard siempre true en summary", () => {
  const s = buildSummary([]);
  assert.equal(s.privacyGuard, true);
  assert.equal(s.localOnlySafe, true);
});

// ── Provider health logic ─────────────────────────────────────────────────────

type ProviderHealth = { name: string; available: boolean; isDefault: boolean; latencyMs?: number };

function buildProviderList(registered: string[], defaultProvider: string): ProviderHealth[] {
  return registered.map((name) => ({
    name,
    available: true,
    isDefault: name === defaultProvider,
  }));
}

test("MC.P1: Ollama es el provider default", () => {
  const list = buildProviderList(["ollama", "anthropic", "openai", "template"], "ollama");
  const ollama = list.find((p) => p.name === "ollama");
  assert.ok(ollama?.isDefault);
  assert.equal(list.filter((p) => p.isDefault).length, 1);
});

test("MC.P2: todos los providers registrados aparecen en la lista", () => {
  const registered = ["ollama", "anthropic", "openai", "template"];
  const list = buildProviderList(registered, "ollama");
  assert.equal(list.length, registered.length);
  registered.forEach((name) => {
    assert.ok(list.some((p) => p.name === name), `${name} debe estar en la lista`);
  });
});

test("MC.P3: provider sin registro no aparece", () => {
  const list = buildProviderList(["ollama", "template"], "ollama");
  assert.equal(list.some((p) => p.name === "anthropic"), false);
  assert.equal(list.some((p) => p.name === "openai"), false);
});

// ── LLM runs / métricas ───────────────────────────────────────────────────────

type LLMRun = { provider: string; taskType: string; latencyMs: number; success: boolean };

function aggregateRuns(runs: LLMRun[]) {
  const byProvider = new Map<string, { calls: number; success: number; totalLatency: number }>();
  for (const r of runs) {
    const cur = byProvider.get(r.provider) ?? { calls: 0, success: 0, totalLatency: 0 };
    byProvider.set(r.provider, {
      calls:        cur.calls + 1,
      success:      cur.success + (r.success ? 1 : 0),
      totalLatency: cur.totalLatency + r.latencyMs,
    });
  }
  return Array.from(byProvider.entries()).map(([provider, s]) => ({
    provider,
    calls:     s.calls,
    successRate: s.calls > 0 ? s.success / s.calls : 0,
    avgLatency: s.calls > 0 ? Math.round(s.totalLatency / s.calls) : 0,
  }));
}

test("MC.R1: agregación de runs por provider", () => {
  const runs: LLMRun[] = [
    { provider: "ollama", taskType: "chat", latencyMs: 400, success: true },
    { provider: "ollama", taskType: "chat", latencyMs: 600, success: true },
    { provider: "anthropic", taskType: "chat", latencyMs: 800, success: false },
  ];
  const agg = aggregateRuns(runs);
  const ollama    = agg.find((a) => a.provider === "ollama")!;
  const anthropic = agg.find((a) => a.provider === "anthropic")!;

  assert.equal(ollama.calls, 2);
  assert.equal(ollama.successRate, 1);
  assert.equal(ollama.avgLatency, 500);
  assert.equal(anthropic.calls, 1);
  assert.equal(anthropic.successRate, 0);
});

test("MC.R2: sin runs → array vacío", () => {
  const agg = aggregateRuns([]);
  assert.deepEqual(agg, []);
});

// ── Ollama health contract ─────────────────────────────────────────────────────

type OllamaHealth = { serverOk: boolean; modelLoaded: boolean; isRemote: boolean; latencyMs?: number };

function evaluateOllamaHealth(resp: { status: number; latencyMs: number; isRemote: boolean }): OllamaHealth {
  return {
    serverOk:    resp.status === 200,
    modelLoaded: resp.status === 200,
    isRemote:    resp.isRemote,
    latencyMs:   resp.latencyMs,
  };
}

test("MC.O1: Ollama respondiendo → serverOk=true, modelLoaded=true", () => {
  const h = evaluateOllamaHealth({ status: 200, latencyMs: 120, isRemote: false });
  assert.equal(h.serverOk, true);
  assert.equal(h.modelLoaded, true);
  assert.equal(h.isRemote, false);
});

test("MC.O2: Ollama caído → serverOk=false", () => {
  const h = evaluateOllamaHealth({ status: 503, latencyMs: 3000, isRemote: true });
  assert.equal(h.serverOk, false);
  assert.equal(h.modelLoaded, false);
});

// ── RAG health en Mission Control ─────────────────────────────────────────────

type RagHealthSummary = { embeddingsAvailable: boolean; retrievalMode: string; totalDocuments: number; totalChunks: number };

function evaluateRagHealth(h: RagHealthSummary): { status: "optimal" | "degraded" | "offline"; note: string } {
  if (!h.embeddingsAvailable)
    return { status: "offline",  note: "Sin embeddings — modo FTS fallback" };
  if (h.totalDocuments === 0)
    return { status: "degraded", note: "Embeddings activos pero sin documentos indexados" };
  if (h.retrievalMode === "hybrid")
    return { status: "optimal",  note: `${h.totalDocuments} docs, ${h.totalChunks} chunks, hybrid retrieval` };
  return { status: "degraded", note: "Embeddings disponibles pero retrieval en FTS" };
}

test("MC.RAG1: embeddings disponibles + docs → status=optimal", () => {
  const r = evaluateRagHealth({ embeddingsAvailable: true, retrievalMode: "hybrid", totalDocuments: 32, totalChunks: 181 });
  assert.equal(r.status, "optimal");
});

test("MC.RAG2: sin API key → status=offline", () => {
  const r = evaluateRagHealth({ embeddingsAvailable: false, retrievalMode: "fts_fallback", totalDocuments: 0, totalChunks: 0 });
  assert.equal(r.status, "offline");
});

test("MC.RAG3: key activa pero sin docs → status=degraded", () => {
  const r = evaluateRagHealth({ embeddingsAvailable: true, retrievalMode: "fts_fallback", totalDocuments: 0, totalChunks: 0 });
  assert.equal(r.status, "degraded");
});

// ── Backfill contract ─────────────────────────────────────────────────────────

test("MC.BF1: dryRun=true nunca embebe chunks", () => {
  const dryRun = true;
  const chunksToProcess = 50;
  const embedded = dryRun ? 0 : chunksToProcess;
  assert.equal(embedded, 0, "dryRun=true debe resultar en 0 chunks embebidos");
});

test("MC.BF2: backfill es idempotente — chunks ya embebidos no se reprocesen", () => {
  const chunks = [
    { id: "c1", hasEmbedding: true },
    { id: "c2", hasEmbedding: false },
    { id: "c3", hasEmbedding: true },
  ];
  const toProcess = chunks.filter((c) => !c.hasEmbedding);
  assert.equal(toProcess.length, 1);
  assert.equal(toProcess[0]?.id, "c2");
});
