/**
 * C39 — Catálogo de precios de modelos de IA versionado (dominio puro).
 * Spec: docs/specs/prometeo/ai-pricing-catalog.spec.md
 *
 * Reglas:
 *  - Desconocido ≠ $0: sin entrada vigente (o con datos insuficientes) el costo es
 *    `null` y `costBasis = "unknown"`. Un cero solo existe si una entrada del
 *    catálogo lo declara explícitamente.
 *  - Intervalos semicerrados `[effectiveFrom, effectiveTo)`; `effectiveTo` nulo = abierto.
 *  - Clave tarifaria = (provider, modelSlug, providerModelName) — el nombre real que
 *    reporta el proveedor, no solo el alias.
 *  - Cada entrada lleva su `pricingSchemaVersion`: el costo de un log se calcula con
 *    la versión de la fila a la que apunta `priceId`; nunca se reinterpreta.
 */
export type PricingCatalogMode = "off" | "shadow" | "on";

export type PriceKey = { provider: string; modelSlug: string; providerModelName: string };

export type PriceEntry = PriceKey & {
  id: string;
  inputPer1K: number;
  outputPer1K: number;
  currency: "USD";
  effectiveFrom: Date;
  effectiveTo: Date | null;
  pricingSchemaVersion: number;
  metadataJson: Record<string, unknown>;
};

export type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  /** Otras unidades (caché, batch, razonamiento…): solo las soporta una versión de esquema que las defina. */
  extraUnits?: Record<string, number>;
};

export type CostResult =
  | { costUsd: number; costBasis: "catalog"; priceId: string }
  | { costUsd: null; costBasis: "unknown"; priceId: null; reason?: string };

/** Valida `metadataJson` contra el esquema de su versión. v1 = solo input/output ⇒ metadata vacía. */
export function validatePriceMetadata(
  version: number,
  metadata: Record<string, unknown>,
): { ok: true } | { ok: false; reason: string } {
  if (version === 1) {
    return Object.keys(metadata ?? {}).length === 0
      ? { ok: true }
      : { ok: false, reason: "pricingSchemaVersion 1 no admite metadataJson (solo input/output)" };
  }
  return { ok: false, reason: `pricingSchemaVersion ${version} no soportada` };
}

/** Unidades que cada versión de esquema sabe calcular. */
const SUPPORTED_EXTRA_UNITS: Record<number, readonly string[]> = { 1: [] };

export function resolvePrice(entries: readonly PriceEntry[], key: PriceKey, at: Date): PriceEntry | undefined {
  const t = at.getTime();
  return entries.find(
    (e) =>
      e.provider === key.provider &&
      e.modelSlug === key.modelSlug &&
      e.providerModelName === key.providerModelName &&
      e.effectiveFrom.getTime() <= t &&
      (e.effectiveTo === null || t < e.effectiveTo.getTime()),
  );
}

const unknown = (reason: string): CostResult => ({ costUsd: null, costBasis: "unknown", priceId: null, reason });

export function computeCost(entry: PriceEntry | undefined, usage: Usage): CostResult {
  if (!entry) return unknown("no_price");
  if (usage.inputTokens === undefined && usage.outputTokens === undefined) return unknown("no_usage");
  const supported = SUPPORTED_EXTRA_UNITS[entry.pricingSchemaVersion];
  if (!supported) return unknown(`unsupported_schema_version:${entry.pricingSchemaVersion}`);
  for (const [unit, amount] of Object.entries(usage.extraUnits ?? {})) {
    if (amount > 0 && !supported.includes(unit)) return unknown(`unsupported_unit:${unit}`);
  }
  const cost =
    ((usage.inputTokens ?? 0) / 1000) * entry.inputPer1K + ((usage.outputTokens ?? 0) / 1000) * entry.outputPer1K;
  return { costUsd: Math.round(cost * 1e6) / 1e6, costBasis: "catalog", priceId: entry.id };
}

/** `off` por defecto. Solo los valores exactos `shadow`/`on` activan algo (fail-safe). */
export function parsePricingCatalogMode(env: NodeJS.ProcessEnv = process.env): PricingCatalogMode {
  const v = env.AI_PRICING_CATALOG_MODE;
  return v === "shadow" || v === "on" ? v : "off";
}
