import { DEFAULT_OVERHEAD, DEFAULT_PROFIT, DEFAULT_TAX, SEMSE_FEE_RATE } from "../core/cost-engine.js";
import type { QuoteSummary, SemseToolResult } from "../core/types.js";

export function calculateQuoteFromToolResult(result: SemseToolResult): QuoteSummary {
  const subtotal = result.costs.materials + result.costs.labor;
  const contingency = Math.max(0, subtotal * riskContingency(result.risk.level));
  const overhead = subtotal * DEFAULT_OVERHEAD;
  const profit = (subtotal + overhead + contingency) * DEFAULT_PROFIT;
  const semseFee = subtotal * SEMSE_FEE_RATE;
  const preTax = subtotal + overhead + profit + semseFee + contingency;
  const taxes = preTax * DEFAULT_TAX;
  const total = preTax + taxes;
  const recommendedDeposit = round2(total * depositRate(result.risk.level));
  const recommendedEscrow = round2(total - recommendedDeposit);

  return {
    materials: round2(result.costs.materials),
    labor: round2(result.costs.labor),
    overhead: round2(overhead),
    profit: round2(profit),
    semseFee: round2(semseFee),
    contingency: round2(contingency),
    taxes: round2(taxes),
    subtotal: round2(subtotal),
    total: round2(total),
    recommendedDeposit,
    recommendedEscrow,
    currency: "USD",
    notes: [
      `Riesgo ${result.risk.level} ajusta la contingencia.`,
      "Base calculada desde materiales + mano de obra.",
    ],
  };
}

function riskContingency(level: SemseToolResult["risk"]["level"]): number {
  switch (level) {
    case "critical": return 0.18;
    case "high": return 0.12;
    case "medium": return 0.08;
    default: return 0.05;
  }
}

function depositRate(level: SemseToolResult["risk"]["level"]): number {
  switch (level) {
    case "critical": return 0.45;
    case "high": return 0.40;
    case "medium": return 0.35;
    default: return 0.30;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
