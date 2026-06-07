/**
 * Unit tests for the tools labor engine — pure functions, no I/O.
 * Run: node --experimental-strip-types --test tests/unit/labor-engine.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Inline labor engine ────────────────────────────────────────────────────────

type Difficulty = "easy" | "medium" | "hard" | "expert";
type LaborEstimate = { hours: number; crewSize: number; days: number; ratePerHour: number; totalCost: number; difficulty: Difficulty; notes: string[] };
type LaborProfile = { baseHours: number; crewSize: number; ratePerHour: number; difficulty: Difficulty; notes?: string[] };

function round2(n: number) { return Math.round(n * 100) / 100; }

function estimateLabor(p: LaborProfile): LaborEstimate {
  const hours = Math.max(0, p.baseHours);
  const crew = Math.max(1, Math.round(p.crewSize));
  return {
    hours: round2(hours),
    crewSize: crew,
    days: Math.max(1, Math.ceil(hours / (8 * crew))),
    ratePerHour: round2(p.ratePerHour),
    totalCost: round2(hours * crew * p.ratePerHour),
    difficulty: p.difficulty,
    notes: p.notes ?? [],
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test("basic: 8 hours, 1 worker, $35/hr → 1 day, $280 total", () => {
  const r = estimateLabor({ baseHours: 8, crewSize: 1, ratePerHour: 35, difficulty: "easy" });
  assert.equal(r.hours, 8);
  assert.equal(r.crewSize, 1);
  assert.equal(r.days, 1);
  assert.equal(r.totalCost, 280);
});

test("days calculated as ceil(hours / (8 * crew))", () => {
  // 24 hours / (8 * 2) = 1.5 → ceil = 2 days
  const r = estimateLabor({ baseHours: 24, crewSize: 2, ratePerHour: 40, difficulty: "medium" });
  assert.equal(r.days, 2);
});

test("days minimum is 1 even for small jobs", () => {
  const r = estimateLabor({ baseHours: 1, crewSize: 5, ratePerHour: 50, difficulty: "easy" });
  assert.equal(r.days, 1);
});

test("totalCost = hours × crew × ratePerHour", () => {
  const r = estimateLabor({ baseHours: 16, crewSize: 3, ratePerHour: 45, difficulty: "hard" });
  assert.equal(r.totalCost, round2(16 * 3 * 45));
});

test("negative hours → clamped to 0 hours, 1 day, 0 cost", () => {
  const r = estimateLabor({ baseHours: -10, crewSize: 2, ratePerHour: 40, difficulty: "easy" });
  assert.equal(r.hours, 0);
  assert.equal(r.totalCost, 0);
  assert.equal(r.days, 1);
});

test("fractional crew rounds to nearest integer (min 1)", () => {
  const r = estimateLabor({ baseHours: 8, crewSize: 1.7, ratePerHour: 30, difficulty: "medium" });
  assert.equal(r.crewSize, 2);
});

test("zero crew → clamped to 1", () => {
  const r = estimateLabor({ baseHours: 8, crewSize: 0, ratePerHour: 30, difficulty: "easy" });
  assert.equal(r.crewSize, 1);
});

test("difficulty stored correctly", () => {
  for (const d of ["easy", "medium", "hard", "expert"] as Difficulty[]) {
    const r = estimateLabor({ baseHours: 8, crewSize: 1, ratePerHour: 35, difficulty: d });
    assert.equal(r.difficulty, d);
  }
});

test("notes passed through correctly", () => {
  const notes = ["Use safety harness", "Permit required"];
  const r = estimateLabor({ baseHours: 8, crewSize: 1, ratePerHour: 35, difficulty: "hard", notes });
  assert.deepEqual(r.notes, notes);
});

test("no notes → empty array", () => {
  const r = estimateLabor({ baseHours: 8, crewSize: 1, ratePerHour: 35, difficulty: "easy" });
  assert.deepEqual(r.notes, []);
});

test("large job: 200 hours, 5 crew, $65/hr → 5 days, $65,000 total", () => {
  const r = estimateLabor({ baseHours: 200, crewSize: 5, ratePerHour: 65, difficulty: "expert" });
  assert.equal(r.days, 5); // 200 / (8 * 5) = 5
  assert.equal(r.totalCost, round2(200 * 5 * 65));
});
