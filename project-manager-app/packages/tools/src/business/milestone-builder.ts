import type { MilestonePlan, SemseToolResult } from "../core/types.js";

export function buildMilestonePlan(result: SemseToolResult): MilestonePlan {
  return {
    trade: result.trade,
    totalAmount: result.costs.total,
    riskLevel: result.risk.level,
    milestones: [...result.milestones],
    fundingSchedule: result.milestones.map((milestone) => milestone.amount),
  };
}
