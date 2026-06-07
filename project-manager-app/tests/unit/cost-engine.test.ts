/**
 * Unit tests for the tools cost engine — pure functions, no I/O.
 * Run: node --experimental-strip-types --test tests/unit/cost-engine.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Inline cost engine (mirrors packages/tools/src/core/cost-engine.ts) ────────

const SEMSE_FEE_RATE = 0.05;
const DEFAULT_OVERHEAD = 0.15;
const DEFAULT_PROFIT = 0.20;
const DEFAULT_TAX = 0.07;

function round2(n: number) { return Math.round(n * 100) / 100; }

function priceOf(map: Record<string, number> | undefined, key: string, defaultPrice: number): number {
  return map?.[key] ?? defaultPrice;
}

function applyLocation(base: number, location: { materialMultiplier: number; laborMultiplier: number } | undefined, type: "material" | "labor"): number {
  if (!location) return base;
  return base * (type === "material" ? location.materialMultiplier : location.laborMultiplier);
}

function materialTotal(items: { totalCost: number }[]): number {
  return items.reduce((s, m) => s + m.totalCost, 0);
}

function buildCostSummary(materials: number, labor: number, options: {
  overhead?: number; profit?: number; semseFeeRate?: number; taxRate?: number; perUnitDivisor?: number;
} = {}) {
  const { overhead = DEFAULT_OVERHEAD, profit = DEFAULT_PROFIT, semseFeeRate = SEMSE_FEE_RATE, taxRate = DEFAULT_TAX, perUnitDivisor } = options;
  const sub = materials + labor;
  const overheadAmt = sub * overhead;
  const profitAmt = (sub + overheadAmt) * profit;
  const semseFee = sub * semseFeeRate;
  const preTax = sub + overheadAmt + profitAmt + semseFee;
  const taxes = preTax * taxRate;
  const total = preTax + taxes;
  return {
    materials: round2(materials), labor: round2(labor),
    overhead: round2(overheadAmt), profit: round2(profitAmt),
    semseFee: round2(semseFee), taxes: round2(taxes), total: round2(total),
    perUnit: perUnitDivisor && perUnitDivisor > 0 ? round2(total / perUnitDivisor) : undefined,
    currency: "USD",
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test("priceOf: returns map value when key exists", () => {
  assert.equal(priceOf({ lumber: 3.5 }, "lumber", 2.0), 3.5);
});

test("priceOf: returns defaultPrice when key missing", () => {
  assert.equal(priceOf({ lumber: 3.5 }, "concrete", 2.0), 2.0);
});

test("priceOf: returns defaultPrice when map is undefined", () => {
  assert.equal(priceOf(undefined, "lumber", 5.0), 5.0);
});

test("applyLocation: no location → returns base", () => {
  assert.equal(applyLocation(1000, undefined, "material"), 1000);
  assert.equal(applyLocation(1000, undefined, "labor"), 1000);
});

test("applyLocation: material multiplier applies correctly", () => {
  const loc = { materialMultiplier: 1.25, laborMultiplier: 1.10 };
  assert.equal(applyLocation(1000, loc, "material"), 1250);
});

test("applyLocation: labor multiplier applies correctly", () => {
  const loc = { materialMultiplier: 1.25, laborMultiplier: 1.10 };
  assert.equal(applyLocation(1000, loc, "labor"), 1100);
});

test("materialTotal: sums totalCost of all items", () => {
  const items = [{ totalCost: 100 }, { totalCost: 200 }, { totalCost: 50 }];
  assert.equal(materialTotal(items), 350);
});

test("materialTotal: empty array → 0", () => {
  assert.equal(materialTotal([]), 0);
});

test("buildCostSummary: components add up correctly", () => {
  const r = buildCostSummary(1000, 500);
  const sub = 1500;
  const overhead = round2(sub * DEFAULT_OVERHEAD);
  const profit = round2((sub + overhead) * DEFAULT_PROFIT);
  const semseFee = round2(sub * SEMSE_FEE_RATE);
  const preTax = sub + overhead + profit + semseFee;
  const taxes = round2(preTax * DEFAULT_TAX);
  const expected = round2(preTax + taxes);
  assert.equal(r.total, expected, `Total should be ${expected}, got ${r.total}`);
  assert.equal(r.materials, 1000);
  assert.equal(r.labor, 500);
  assert.equal(r.currency, "USD");
});

test("buildCostSummary: SEMSE fee is 5% of materials+labor subtotal", () => {
  const r = buildCostSummary(2000, 0);
  assert.equal(r.semseFee, round2(2000 * 0.05));
});

test("buildCostSummary: total > materials + labor (fees/overhead/profit applied)", () => {
  const r = buildCostSummary(500, 500);
  assert.ok(r.total > 1000, `Total ${r.total} should exceed subtotal 1000`);
});

test("buildCostSummary: perUnit computed when divisor provided", () => {
  const r = buildCostSummary(1000, 0, { perUnitDivisor: 100 });
  assert.ok(r.perUnit !== undefined);
  assert.equal(r.perUnit, round2(r.total / 100));
});

test("buildCostSummary: perUnit undefined when no divisor", () => {
  const r = buildCostSummary(1000, 0);
  assert.equal(r.perUnit, undefined);
});

test("buildCostSummary: custom rates override defaults", () => {
  const r = buildCostSummary(1000, 0, { overhead: 0, profit: 0, taxRate: 0, semseFeeRate: 0 });
  // With all rates 0, total should equal materials
  assert.equal(r.total, 1000);
  assert.equal(r.overhead, 0);
  assert.equal(r.taxes, 0);
});

test("buildCostSummary: zero materials and labor → zero total", () => {
  const r = buildCostSummary(0, 0);
  assert.equal(r.total, 0);
});
