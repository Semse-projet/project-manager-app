/**
 * Unit tests for the tools material engine — pure functions, no I/O.
 * Run: node --experimental-strip-types --test tests/unit/material-engine.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Inline functions (mirrors packages/tools/src/core/material-engine.ts + cost-engine.ts) ──

type MaterialItem = { name: string; quantity: number; unit: string; unitCost: number; totalCost: number; category: string; notes?: string };

function round2(n: number) { return Math.round(n * 100) / 100; }

function material(name: string, quantity: number, unit: string, unitCost: number, category: string, notes?: string): MaterialItem {
  return { name, quantity: round2(quantity), unit, unitCost, totalCost: round2(quantity * unitCost), category, notes };
}

function makeMaterial(name: string, quantity: number, unit: string, unitCost: number, category: string, notes?: string): MaterialItem {
  return material(name, quantity, unit, unitCost, category, notes);
}

function scaleMaterials(items: MaterialItem[], factor: number): MaterialItem[] {
  return items.map(item => material(item.name, item.quantity * factor, item.unit, item.unitCost, item.category, item.notes));
}

function materialTotal(items: MaterialItem[]): number {
  return items.reduce((s, m) => s + m.totalCost, 0);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test("material: totalCost = quantity × unitCost", () => {
  const m = material("Drywall 4x8", 20, "sheet", 15.50, "drywall");
  assert.equal(m.totalCost, 310);
  assert.equal(m.quantity, 20);
  assert.equal(m.unitCost, 15.50);
});

test("material: fractional quantities rounded to 2 decimals", () => {
  const m = material("Joint compound", 3.333, "bucket", 12.0, "finishing");
  assert.equal(m.quantity, 3.33);
  // totalCost is round2(originalQty * unitCost) = round2(3.333 * 12) = round2(39.996) = 40
  assert.equal(m.totalCost, 40);
});

test("material: stores all fields correctly", () => {
  const m = material("Primer", 2, "gal", 25, "paint", "Interior latex");
  assert.equal(m.name, "Primer");
  assert.equal(m.unit, "gal");
  assert.equal(m.category, "paint");
  assert.equal(m.notes, "Interior latex");
});

test("makeMaterial: identical to material()", () => {
  const a = material("Lumber", 100, "bf", 3.5, "framing");
  const b = makeMaterial("Lumber", 100, "bf", 3.5, "framing");
  assert.deepEqual(a, b);
});

test("scaleMaterials: multiplies quantity and recalculates totalCost", () => {
  const items = [
    material("Paint", 2, "gal", 30, "paint"),
    material("Tape", 5, "roll", 4, "masking"),
  ];
  const scaled = scaleMaterials(items, 2);
  assert.equal(scaled[0].quantity, 4);
  assert.equal(scaled[0].totalCost, 120);
  assert.equal(scaled[1].quantity, 10);
  assert.equal(scaled[1].totalCost, 40);
});

test("scaleMaterials: factor 1 returns identical values", () => {
  const items = [material("Drywall", 10, "sheet", 12, "drywall")];
  const scaled = scaleMaterials(items, 1);
  assert.equal(scaled[0].totalCost, items[0].totalCost);
});

test("scaleMaterials: factor 0 returns zero totals", () => {
  const items = [material("Lumber", 50, "bf", 3, "framing")];
  const scaled = scaleMaterials(items, 0);
  assert.equal(scaled[0].quantity, 0);
  assert.equal(scaled[0].totalCost, 0);
});

test("materialTotal: sums all totalCosts", () => {
  const items = [
    material("Drywall", 20, "sheet", 15, "drywall"),     // 300
    material("Screws", 5, "lb", 4, "fasteners"),         // 20
    material("Joint compound", 3, "bucket", 15, "finishing"), // 45
  ];
  assert.equal(materialTotal(items), 365);
});

test("materialTotal: empty array → 0", () => {
  assert.equal(materialTotal([]), 0);
});

test("materialTotal: single item → its totalCost", () => {
  const item = material("Roofing felt", 4, "roll", 22.5, "roofing");
  assert.equal(materialTotal([item]), item.totalCost);
});

test("scaleMaterials: preserves name, unit, category, notes", () => {
  const items = [material("Flashing", 10, "lf", 2.5, "roofing", "Aluminum")];
  const scaled = scaleMaterials(items, 3);
  assert.equal(scaled[0].name, "Flashing");
  assert.equal(scaled[0].unit, "lf");
  assert.equal(scaled[0].category, "roofing");
  assert.equal(scaled[0].notes, "Aluminum");
});
