import type { EscrowPlan, SemseToolResult } from "../core/types.js";
import { calculateQuoteFromToolResult } from "./quote-engine.js";

export function buildEscrowPlan(result: SemseToolResult): EscrowPlan {
  const quote = calculateQuoteFromToolResult(result);
  const totalAmount = quote.total;
  const initialDeposit = quote.recommendedDeposit;
  const holdback = round2(totalAmount * holdbackRate(result.risk.level));
  const releaseSchedule = result.milestones.map((milestone) => round2(milestone.amount));

  return {
    trade: result.trade,
    totalAmount: round2(totalAmount),
    initialDeposit,
    holdback,
    releaseSchedule,
    recommendedReserve: round2(totalAmount * reserveRate(result.risk.level)),
    notes: [
      "El escrow debe liberar fondos solo con evidencia aprobada.",
      "A mayor riesgo, mayor reserva de retención.",
    ],
  };
}

function holdbackRate(level: SemseToolResult["risk"]["level"]): number {
  switch (level) {
    case "critical": return 0.20;
    case "high": return 0.15;
    case "medium": return 0.10;
    default: return 0.05;
  }
}

function reserveRate(level: SemseToolResult["risk"]["level"]): number {
  switch (level) {
    case "critical": return 0.12;
    case "high": return 0.10;
    case "medium": return 0.08;
    default: return 0.05;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
