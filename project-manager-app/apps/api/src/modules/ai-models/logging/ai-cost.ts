/**
 * C39 — optional cost estimation. There is deliberately NO built-in price
 * list: prices are a product decision and go stale. Operators supply them via
 * AI_MODEL_PRICING_JSON, e.g.
 *   {"claude-sonnet":{"inputPer1K":0.003,"outputPer1K":0.015}}
 * (USD per 1K tokens). Without an entry for the model the cost stays null.
 */
export type ModelPrice = { inputPer1K: number; outputPer1K: number };

export function parseModelPricing(raw: string | undefined): Record<string, ModelPrice> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, ModelPrice> = {};
    for (const [slug, value] of Object.entries(parsed)) {
      const v = value as Partial<ModelPrice> | null;
      if (
        v && typeof v.inputPer1K === "number" && typeof v.outputPer1K === "number" &&
        Number.isFinite(v.inputPer1K) && Number.isFinite(v.outputPer1K) &&
        v.inputPer1K >= 0 && v.outputPer1K >= 0
      ) {
        out[slug] = { inputPer1K: v.inputPer1K, outputPer1K: v.outputPer1K };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function estimateCostUsd(
  modelSlug: string,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
  env: NodeJS.ProcessEnv = process.env,
): number | undefined {
  if (inputTokens === undefined && outputTokens === undefined) return undefined;
  const price = parseModelPricing(env.AI_MODEL_PRICING_JSON)[modelSlug];
  if (!price) return undefined;
  const cost = ((inputTokens ?? 0) / 1000) * price.inputPer1K + ((outputTokens ?? 0) / 1000) * price.outputPer1K;
  return Math.round(cost * 1e6) / 1e6;
}
