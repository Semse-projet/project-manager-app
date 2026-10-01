import test from "node:test";
import assert from "node:assert/strict";
import { AiInteractionLoggerService } from "../dist/modules/ai-models/logging/ai-interaction-logger.service.js";

// C39 — modos del logger: off (default, legado intacto), shadow (guarda legado, registra discrepancia), on (solo catálogo).

const LEGACY = JSON.stringify({ "claude-sonnet": { inputPer1K: 0.003, outputPer1K: 0.015 } });
const res = { output: "ok", provider: "anthropic", modelSlug: "claude-sonnet", modelName: "claude-sonnet-x", inputTokens: 2000, outputTokens: 1000, latencyMs: 1, success: true } as any;
const req = { taskType: "general_chat", input: "hi", metadata: { tenantId: "t1" } } as any;

function build(catalog?: any) {
  const created: any[] = [];
  const prisma = { aiInteractionLog: { create: async ({ data }: any) => { created.push(data); return data; } } };
  const svc = new AiInteractionLoggerService(prisma as never, catalog);
  const warns: string[] = [];
  (svc as any).logger = { log() {}, warn: (m: string) => warns.push(m) };
  return { svc, created, warns };
}
const withEnv = async (env: Record<string, string | undefined>, fn: () => Promise<void>) => {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) { prev[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  try { await fn(); } finally { for (const k of Object.keys(env)) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; } }
};
const catalogReturning = (r: any) => ({ calls: [] as any[], async resolveCost(key: any, at: Date, usage: any) { (this as any).calls.push({ key, at, usage }); return r; } });

test("off (default): comportamiento legado, sin costBasis/priceId y sin consultar el catálogo", async () => {
  await withEnv({ AI_PRICING_CATALOG_MODE: undefined, AI_MODEL_PRICING_JSON: LEGACY }, async () => {
    const cat = catalogReturning({ costUsd: 99, costBasis: "catalog", priceId: "px" });
    const { svc, created } = build(cat);
    await svc.logInteraction(req, res);
    assert.equal(created[0].estimatedCostUsd, 0.021);
    assert.equal(created[0].costBasis, undefined);
    assert.equal(created[0].priceId, undefined);
    assert.equal((cat as any).calls.length, 0);
  });
});

test("off con valor inválido del flag: sigue en off (fail-safe)", async () => {
  await withEnv({ AI_PRICING_CATALOG_MODE: "true", AI_MODEL_PRICING_JSON: LEGACY }, async () => {
    const { svc, created } = build(catalogReturning({ costUsd: 99, costBasis: "catalog", priceId: "px" }));
    await svc.logInteraction(req, res);
    assert.equal(created[0].estimatedCostUsd, 0.021);
    assert.equal(created[0].priceId, undefined);
  });
});

test("shadow: se guarda el costo LEGADO, se registra la discrepancia y no se escribe priceId", async () => {
  await withEnv({ AI_PRICING_CATALOG_MODE: "shadow", AI_MODEL_PRICING_JSON: LEGACY }, async () => {
    const { svc, created, warns } = build(catalogReturning({ costUsd: 0.5, costBasis: "catalog", priceId: "px" }));
    await svc.logInteraction(req, res);
    assert.equal(created[0].estimatedCostUsd, 0.021);
    assert.equal(created[0].priceId, undefined);
    assert.ok(warns.some((w) => w.includes("ai_pricing_catalog_mismatch")));
  });
});

test("shadow: si un fallo del catálogo, el logging no se rompe", async () => {
  await withEnv({ AI_PRICING_CATALOG_MODE: "shadow", AI_MODEL_PRICING_JSON: LEGACY }, async () => {
    const { svc, created } = build({ async resolveCost() { throw new Error("db down"); } });
    await svc.logInteraction(req, res);
    assert.equal(created[0].estimatedCostUsd, 0.021);
  });
});

test("on: usa SOLO el catálogo (costo, costBasis, priceId) con la clave provider+slug+modelName", async () => {
  await withEnv({ AI_PRICING_CATALOG_MODE: "on", AI_MODEL_PRICING_JSON: undefined }, async () => {
    const cat = catalogReturning({ costUsd: 0.04, costBasis: "catalog", priceId: "px" });
    const { svc, created } = build(cat);
    await svc.logInteraction(req, res);
    assert.equal(created[0].estimatedCostUsd, 0.04);
    assert.equal(created[0].costBasis, "catalog");
    assert.equal(created[0].priceId, "px");
    assert.deepEqual((cat as any).calls[0].key, { provider: "anthropic", modelSlug: "claude-sonnet", providerModelName: "claude-sonnet-x" });
    assert.deepEqual((cat as any).calls[0].usage, { inputTokens: 2000, outputTokens: 1000 });
  });
});

test("on SIN FALLBACK: catálogo sin entrada ⇒ costo vacío + unknown, aunque AI_MODEL_PRICING_JSON tenga el modelo y el proveedor reporte costo", async () => {
  await withEnv({ AI_PRICING_CATALOG_MODE: "on", AI_MODEL_PRICING_JSON: LEGACY }, async () => {
    const { svc, created, warns } = build(catalogReturning({ costUsd: null, costBasis: "unknown", priceId: null, reason: "no_price" }));
    await svc.logInteraction(req, { ...res, estimatedCost: 1.23 });
    assert.equal(created[0].estimatedCostUsd, undefined); // NULL en base, nunca 0 ni el legado
    assert.notEqual(created[0].estimatedCostUsd, 0);
    assert.equal(created[0].costBasis, "unknown");
    assert.equal(created[0].priceId, undefined);
    assert.ok(warns.some((w) => w.includes("ai_cost_unknown")));
  });
});

test("on: sin catálogo inyectado, error del catálogo o sin modelName ⇒ unknown (nunca legado ni 0)", async () => {
  await withEnv({ AI_PRICING_CATALOG_MODE: "on", AI_MODEL_PRICING_JSON: LEGACY }, async () => {
    for (const [catalog, response] of [
      [undefined, res],
      [{ async resolveCost() { throw new Error("db down"); } }, res],
      [catalogReturning({ costUsd: 1, costBasis: "catalog", priceId: "px" }), { ...res, modelName: undefined }],
    ] as const) {
      const { svc, created } = build(catalog);
      await svc.logInteraction(req, response as any);
      assert.equal(created[0].estimatedCostUsd, undefined);
      assert.equal(created[0].costBasis, "unknown");
    }
  });
});
