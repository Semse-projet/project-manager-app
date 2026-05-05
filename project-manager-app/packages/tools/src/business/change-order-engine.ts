import type { SemseToolResult } from "../core/types.js";

export type ChangeOrderImpact = {
  trade: SemseToolResult["trade"];
  deltaPercent: number;
  deltaAmount: number;
  recommendedDepositAdjustment: number;
  notes: string[];
};

export function calculateChangeOrderImpact(result: SemseToolResult, deltaPercent: number): ChangeOrderImpact {
  const bounded = Math.max(0, deltaPercent);
  const deltaAmount = round2(result.costs.total * (bounded / 100));
  return {
    trade: result.trade,
    deltaPercent: bounded,
    deltaAmount,
    recommendedDepositAdjustment: round2(deltaAmount * 0.35),
    notes: [
      "Todo cambio de alcance debe quedar documentado.",
      "Si supera el umbral de riesgo, revalidar permisos y evidencia.",
    ],
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
