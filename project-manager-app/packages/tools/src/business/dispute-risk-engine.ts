import type { SemseToolResult } from "../core/types.js";

export type DisputeRiskSnapshot = {
  trade: SemseToolResult["trade"];
  score: number;
  level: "low" | "medium" | "high" | "critical";
  factors: string[];
};

export function calculateDisputeRisk(result: SemseToolResult): DisputeRiskSnapshot {
  const score = Math.min(
    100,
    Math.round(
      result.risk.score +
      (result.validationIssues.filter((issue) => issue.severity === "error").length * 12) +
      (result.warnings.length * 4)
    )
  );

  return {
    trade: result.trade,
    score,
    level: score >= 75 ? "critical" : score >= 50 ? "high" : score >= 25 ? "medium" : "low",
    factors: [
      ...result.validationIssues.map((issue) => `${issue.field}:${issue.severity}`),
      ...result.warnings,
    ],
  };
}
