import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { SystemObserverService } from "../dist/modules/ops/observer.service.js";
import { RecommendationEngineService } from "../dist/modules/ops/recommendation-engine.service.js";

const forbiddenInstruction = /OPENAI_API_KEY|(?:POST|Ejecutar)\s+\/v1\/prometeo\/embeddings\/backfill|Agregar.*OpenAI.*Railway/i;

test("L14 ops observer recommends private/local recovery, never cloud key or legacy backfill", () => {
  // TypeScript private is not a runtime security boundary. This exercises
  // the real compiled service's alert generation, without DB/LLM/network.
  const observer = Object.create(SystemObserverService.prototype) as
    { generateAlerts: (...args: unknown[]) => Array<{ area: string; recommendation: string }> };
  const infra = { items: [] };
  const op = {
    criticalSignals: 0, highSignals: 0,
    milestones: { blockedPayment: 0 }, changeOrders: { pendingCount: 0 },
  };
  const intel = {
    fallbackRate: 0, llmTotalCalls: 0, ollamaAvailable: true,
    embeddingsMode: "fts_fallback", ragMissingEmbeddings: 20,
  };
  const fallback = observer.generateAlerts(infra, op, intel, []);
  const ragFallback = fallback.find(x => x.area === "Prometeo RAG");
  assert.ok(ragFallback);
  assert.doesNotMatch(ragFallback.recommendation, forbiddenInstruction);
  assert.match(ragFallback.recommendation, /local-only|FTS local/i);

  const missing = observer.generateAlerts(infra, op, { ...intel, embeddingsMode: "hybrid" }, []);
  const ragMissing = missing.find(x => x.area === "Prometeo RAG");
  assert.ok(ragMissing);
  assert.doesNotMatch(ragMissing.recommendation, forbiddenInstruction);
  assert.match(ragMissing.recommendation, /No ejecutar backfill heredado/);
});

test("L14 recommendation engine only drafts local-only work, not cloud-enable actions", async () => {
  const engine = new RecommendationEngineService(
    { observe: async () => ({
      alerts: [], healthScore: 85, intelligenceHealth: {
        ragDocuments: 3, embeddingsMode: "fts_fallback",
      },
      operationalHealth: { criticalSignals: 0 },
    }) } as never,
    { buildIndex: async () => ({ maturity: { byModule: [] } }) } as never,
  );
  const result = await engine.generate("synthetic_tenant");
  const rag = result.recommendations.find(r => r.id === "fix-embeddings");
  assert.ok(rag);
  const rendered = JSON.stringify(rag);
  assert.doesNotMatch(rendered, forbiddenInstruction);
  assert.match(rendered, /local-only|locales/i);
  assert.match(rendered, /consentimiento/i);
  assert.match(rendered, /No ejecutar CLI L14 retirada/);
  const trade = result.recommendations.find(r => r.id === "trade-library-expand");
  assert.ok(trade);
  assert.ok(trade.draftPRScope.some(x => /public_training no es consentimiento ni ACL/.test(x)));
});

test("L14 trade ingestion status does not instruct operators to set a cloud API key", () => {
  const path = fileURLToPath(new URL("../../../scripts/trade-knowledge-ingest.mjs", import.meta.url));
  const source = readFileSync(path, "utf8");
  assert.doesNotMatch(source, /OPENAI_API_KEY not set or unhealthy/);
  assert.match(source, /FTS fallback local: no habilitar OpenAI para documentos privados/);
  assert.match(source, /backfill L14 bloqueado/);
});
