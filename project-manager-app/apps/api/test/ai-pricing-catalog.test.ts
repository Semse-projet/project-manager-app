import test from "node:test";
import assert from "node:assert/strict";
import {
  computeCost,
  parsePricingCatalogMode,
  resolvePrice,
  validatePriceMetadata,
  type PriceEntry,
} from "../dist/modules/ai-models/pricing/ai-pricing-catalog.js";

// C39 — catálogo versionado: resolución por fecha, unknown != 0, identidad real del
// modelo, esquema versionado e inmutabilidad. Dominio puro (sin base de datos).

const key = { provider: "anthropic", modelSlug: "claude-sonnet", providerModelName: "claude-sonnet-x" };
const d = (s: string) => new Date(s);
function entry(over: Partial<PriceEntry> = {}): PriceEntry {
  return {
    id: "p1", ...key, inputPer1K: 0.003, outputPer1K: 0.015, currency: "USD",
    effectiveFrom: d("2026-01-01T00:00:00Z"), effectiveTo: null,
    pricingSchemaVersion: 1, metadataJson: {}, ...over,
  };
}

test("resolvePrice: intervalo semicerrado [from, to) y precio anterior para fechas previas al cambio", () => {
  const old = entry({ id: "old", inputPer1K: 0.001, effectiveTo: d("2026-06-01T00:00:00Z") });
  const cur = entry({ id: "cur", inputPer1K: 0.003, effectiveFrom: d("2026-06-01T00:00:00Z") });
  assert.equal(resolvePrice([old, cur], key, d("2026-05-31T23:59:59Z"))?.id, "old");
  assert.equal(resolvePrice([old, cur], key, d("2026-06-01T00:00:00Z"))?.id, "cur"); // el límite pertenece a la nueva
  assert.equal(resolvePrice([old, cur], key, d("2025-12-31T00:00:00Z")), undefined); // antes de toda vigencia
});

test("resolvePrice: la clave incluye providerModelName (no solo el alias)", () => {
  const e = entry();
  assert.equal(resolvePrice([e], { ...key, providerModelName: "otro-modelo-fisico" }, d("2026-03-01T00:00:00Z")), undefined);
  assert.equal(resolvePrice([e], { ...key, provider: "openai" }, d("2026-03-01T00:00:00Z")), undefined);
});

test("computeCost: tokens × precio por 1K con redondeo a 6 decimales, costBasis=catalog y priceId", () => {
  const r = computeCost(entry(), { inputTokens: 2000, outputTokens: 1000 });
  assert.deepEqual(r, { costUsd: 0.021, costBasis: "catalog", priceId: "p1" });
});

test("computeCost: unknown ≠ $0 — sin entrada vigente el costo es null y basis unknown", () => {
  const r = computeCost(undefined, { inputTokens: 5000, outputTokens: 5000 });
  assert.equal(r.costUsd, null);
  assert.equal(r.costBasis, "unknown");
  assert.equal(r.priceId, null);
  assert.notEqual(r.costUsd, 0);
});

test("computeCost: un cero solo existe si la entrada del catálogo lo declara explícitamente", () => {
  const free = entry({ id: "local", inputPer1K: 0, outputPer1K: 0 });
  assert.deepEqual(computeCost(free, { inputTokens: 1000, outputTokens: 1000 }), { costUsd: 0, costBasis: "catalog", priceId: "local" });
});

test("computeCost: sin tokens conocidos no se inventa un costo", () => {
  const r = computeCost(entry(), {});
  assert.equal(r.costUsd, null);
  assert.equal(r.costBasis, "unknown");
});

test("pricingSchemaVersion: v1 solo input/output; una unidad no soportada ⇒ unknown (no se ignora)", () => {
  const r = computeCost(entry(), { inputTokens: 1000, outputTokens: 1000, extraUnits: { cacheReadTokens: 500 } });
  assert.equal(r.costUsd, null);
  assert.equal(r.costBasis, "unknown");
  // una unidad en 0 no cambia nada
  assert.equal(computeCost(entry(), { inputTokens: 1000, outputTokens: 0, extraUnits: { cacheReadTokens: 0 } }).costBasis, "catalog");
});

test("pricingSchemaVersion desconocida en la fila ⇒ unknown (el histórico no se reinterpreta)", () => {
  const r = computeCost(entry({ pricingSchemaVersion: 99 }), { inputTokens: 1000, outputTokens: 1000 });
  assert.equal(r.costBasis, "unknown");
  assert.equal(r.costUsd, null);
});

test("validatePriceMetadata: v1 exige metadataJson vacío; versión desconocida se rechaza", () => {
  assert.equal(validatePriceMetadata(1, {}).ok, true);
  assert.equal(validatePriceMetadata(1, { cacheReadPer1K: 0.001 }).ok, false);
  assert.equal(validatePriceMetadata(2, {}).ok, false);
});

test("parsePricingCatalogMode: off por defecto; solo shadow/on exactos las activan", () => {
  assert.equal(parsePricingCatalogMode({}), "off");
  assert.equal(parsePricingCatalogMode({ AI_PRICING_CATALOG_MODE: "" }), "off");
  assert.equal(parsePricingCatalogMode({ AI_PRICING_CATALOG_MODE: "ON" }), "off"); // fail-safe: valor no exacto
  assert.equal(parsePricingCatalogMode({ AI_PRICING_CATALOG_MODE: "shadow" }), "shadow");
  assert.equal(parsePricingCatalogMode({ AI_PRICING_CATALOG_MODE: "on" }), "on");
  assert.equal(parsePricingCatalogMode({ AI_PRICING_CATALOG_MODE: "true" }), "off");
});
