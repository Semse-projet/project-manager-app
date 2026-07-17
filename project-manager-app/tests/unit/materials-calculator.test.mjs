/**
 * Unit tests for the materials calculator (skill: materiales-obra).
 * Run: node --test tests/unit/materials-calculator.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { calculateMaterials, MaterialsCalculatorError } from "../../packages/tools/dist/index.js";

test("painting: room 12x14x9 with 1 door and 2 windows, 2 coats yields 3 gallons", () => {
  const result = calculateMaterials({
    category: "painting",
    lengthFt: 12,
    widthFt: 14,
    heightFt: 9,
    doors: 1,
    windows: 2,
    coats: 2,
  });
  assert.equal(result.category, "painting");
  assert.equal(result.summary.wallAreaSqFt, 52 * 9);
  assert.equal(result.summary.areaSqFt, 468 - 35);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, "Pintura");
  assert.equal(result.items[0].unit, "gal");
  assert.equal(result.items[0].quantity, 3);
});

test("painting: no openings uses defaults and rounds to 1 gallon minimum", () => {
  const result = calculateMaterials({
    category: "painting",
    lengthFt: 1,
    widthFt: 1,
    heightFt: 1,
  });
  assert.equal(result.items[0].quantity, 1);
});

test("drywall: sheets, compound, tape and screws computed with 15% waste", () => {
  const result = calculateMaterials({
    category: "drywall",
    lengthFt: 10,
    widthFt: 10,
    heightFt: 8,
  });
  const wallArea = 40 * 8;
  assert.equal(result.summary.areaSqFt, wallArea);
  const expectedSheets = Math.ceil((wallArea / 32) * 1.15);
  assert.equal(result.items.find((i) => i.name === "Hojas de drywall 4x8")?.quantity, expectedSheets);
  assert.equal(result.items.find((i) => i.name === "Clavos/tornillos")?.quantity, Math.ceil(wallArea / 500));
  assert.equal(result.items.find((i) => i.name === "Joint compound")?.quantity, Math.ceil(wallArea / 225));
  assert.equal(result.items.find((i) => i.name === "Cinta para juntas")?.quantity, Math.ceil(wallArea / 500));
});

test("flooring: 18x22 room straight install adds 10% waste", () => {
  const result = calculateMaterials({
    category: "flooring",
    lengthFt: 18,
    widthFt: 22,
    installation: "straight",
  });
  assert.equal(result.summary.floorAreaSqFt, 396);
  assert.equal(result.summary.areaSqFt, Math.ceil(396 * 1.10));
  assert.equal(result.items[0].quantity, Math.ceil(396 * 1.10));
  assert.ok(result.notes.some((n) => n.includes("10.0%")));
});

test("flooring: diagonal installation adds 15% waste", () => {
  const result = calculateMaterials({
    category: "flooring",
    lengthFt: 10,
    widthFt: 10,
    installation: "diagonal",
  });
  assert.equal(result.summary.areaSqFt, Math.ceil(100 * 1.15));
  assert.ok(result.notes.some((n) => n.includes("15.0%")));
});

test("concrete: 10x20 slab at 4in depth yields 2.7 cubic yards", () => {
  const result = calculateMaterials({
    category: "concrete",
    lengthFt: 10,
    widthFt: 20,
    depthInches: 4,
  });
  assert.equal(result.summary.volumeCuFt, 10 * 20 * (4 / 12));
  assert.equal(result.items[0].quantity, 2.7);
});

test("lumber: 16ft wall with 1 corner yields 14 studs", () => {
  const result = calculateMaterials({
    category: "lumber",
    lengthFt: 16,
    corners: 1,
  });
  const studs = result.items.find((i) => i.name === "Studs 2x4x8")?.quantity;
  assert.equal(studs, Math.ceil(16 / 1.5) + 3);
});

test("lumber: plywood subfloor for 10x10 with 10% waste", () => {
  const result = calculateMaterials({
    category: "lumber",
    lengthFt: 10,
    widthFt: 10,
  });
  const plywood = result.items.find((i) => i.name === "Plywood subfloor 4x8");
  assert.ok(plywood);
  assert.equal(plywood?.quantity, Math.ceil((100 / 32) * 1.10));
});

test("mulch: 1 cubic yard covers 108 sqft at 3in with 10% extra", () => {
  const result = calculateMaterials({
    category: "mulch",
    lengthFt: 9,
    widthFt: 12,
    depthInches: 3,
  });
  const area = 9 * 12;
  assert.equal(result.summary.areaSqFt, area);
  assert.equal(result.items[0].quantity, 1.1);
});

test("mulch: 2in depth uses 162 sqft per cubic yard coverage", () => {
  const result = calculateMaterials({
    category: "mulch",
    lengthFt: 16,
    widthFt: 20,
    depthInches: 2,
  });
  const raw = (16 * 20) / 162;
  const expected = Math.round(Math.ceil(raw * 1.10 * 10) / 10 * 10) / 10;
  assert.equal(result.items[0].quantity, expected);
});

test("rejects input without category", () => {
  assert.throws(() => calculateMaterials({ lengthFt: 10, widthFt: 10 }), MaterialsCalculatorError);
});

test("rejects invalid category", () => {
  assert.throws(() => calculateMaterials({ category: "roofing", lengthFt: 10, widthFt: 10 }), MaterialsCalculatorError);
});

test("rejects negative dimensions", () => {
  assert.throws(() => calculateMaterials({ category: "painting", lengthFt: -1, widthFt: 10, heightFt: 8 }), MaterialsCalculatorError);
});

test("rejects mulch depthInches not 2, 3 or 4", () => {
  assert.throws(() => calculateMaterials({ category: "mulch", lengthFt: 10, widthFt: 10, depthInches: 5 }), MaterialsCalculatorError);
});
