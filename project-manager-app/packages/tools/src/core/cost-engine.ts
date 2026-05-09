import type { CostSummary, MaterialItem } from "./types.js";

export const SEMSE_FEE_RATE = 0.05;   // 5% platform fee
export const DEFAULT_OVERHEAD = 0.15;  // 15%
export const DEFAULT_PROFIT = 0.20;    // 20%
export const DEFAULT_TAX = 0.07;       // 7% — varies by state

export function materialTotal(items: MaterialItem[]): number {
  return items.reduce((s, m) => s + m.totalCost, 0);
}

export function buildCostSummary(
  materials: number,
  labor: number,
  options: {
    overhead?: number;
    profit?: number;
    semseFeeRate?: number;
    taxRate?: number;
    perUnitDivisor?: number;
  } = {}
): CostSummary {
  const {
    overhead = DEFAULT_OVERHEAD,
    profit = DEFAULT_PROFIT,
    semseFeeRate = SEMSE_FEE_RATE,
    taxRate = DEFAULT_TAX,
    perUnitDivisor,
  } = options;

  const sub = materials + labor;
  const overheadAmt = sub * overhead;
  const profitAmt = (sub + overheadAmt) * profit;
  const semseFee = sub * semseFeeRate;
  const preTax = sub + overheadAmt + profitAmt + semseFee;
  const taxes = preTax * taxRate;
  const total = preTax + taxes;

  return {
    materials: round2(materials),
    labor: round2(labor),
    overhead: round2(overheadAmt),
    profit: round2(profitAmt),
    semseFee: round2(semseFee),
    taxes: round2(taxes),
    total: round2(total),
    perUnit: perUnitDivisor && perUnitDivisor > 0 ? round2(total / perUnitDivisor) : undefined,
    currency: "USD",
  };
}

export function material(
  name: string,
  quantity: number,
  unit: string,
  unitCost: number,
  category: string,
  notes?: string
): MaterialItem {
  return { name, quantity: round2(quantity), unit, unitCost, totalCost: round2(quantity * unitCost), category, notes };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
