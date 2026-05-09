import type { RiskFactor, RiskLevel, RiskResult } from "./types.js";

export function scoreToLevel(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

export function computeRisk(
  factors: RiskFactor[],
  overrides?: Partial<Pick<RiskResult, "requiresPermit" | "requiresLicense" | "requiresInspection" | "requiresEngineering">>
): RiskResult {
  const triggered = factors.filter((f) => f.triggered);
  const score = Math.min(
    100,
    Math.round(triggered.reduce((sum, f) => sum + f.weight * 100, 0))
  );

  return {
    level: scoreToLevel(score),
    score,
    factors,
    requiresPermit: overrides?.requiresPermit ?? score >= 50,
    requiresLicense: overrides?.requiresLicense ?? score >= 60,
    requiresInspection: overrides?.requiresInspection ?? score >= 40,
    requiresEngineering: overrides?.requiresEngineering ?? score >= 80,
  };
}

export function factor(id: string, label: string, weight: number, triggered: boolean, reason?: string): RiskFactor {
  return { id, label, weight, triggered, reason };
}
