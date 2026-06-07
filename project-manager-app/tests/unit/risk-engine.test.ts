/**
 * Unit tests for the tools risk scoring engine — pure functions, no I/O.
 * Run: node --experimental-strip-types --test tests/unit/risk-engine.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Inline risk engine (mirrors packages/tools/src/core/risk-engine.ts) ────────

type RiskLevel = "low" | "medium" | "high" | "critical";
type RiskFactor = { id: string; label: string; weight: number; triggered: boolean; reason?: string };
type RiskResult = { level: RiskLevel; score: number; factors: RiskFactor[]; requiresPermit: boolean; requiresLicense: boolean; requiresInspection: boolean; requiresEngineering: boolean };

function scoreToLevel(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

function computeRisk(factors: RiskFactor[], overrides?: Partial<Pick<RiskResult, "requiresPermit" | "requiresLicense" | "requiresInspection" | "requiresEngineering">>): RiskResult {
  const triggered = factors.filter(f => f.triggered);
  const score = Math.min(100, Math.round(triggered.reduce((sum, f) => sum + f.weight * 100, 0)));
  return {
    level: scoreToLevel(score), score, factors,
    requiresPermit: overrides?.requiresPermit ?? score >= 50,
    requiresLicense: overrides?.requiresLicense ?? score >= 60,
    requiresInspection: overrides?.requiresInspection ?? score >= 40,
    requiresEngineering: overrides?.requiresEngineering ?? score >= 80,
  };
}

function factor(id: string, label: string, weight: number, triggered: boolean, reason?: string): RiskFactor {
  return { id, label, weight, triggered, reason };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test("scoreToLevel: 0-24 → low", () => {
  assert.equal(scoreToLevel(0), "low");
  assert.equal(scoreToLevel(24), "low");
});

test("scoreToLevel: 25-49 → medium", () => {
  assert.equal(scoreToLevel(25), "medium");
  assert.equal(scoreToLevel(49), "medium");
});

test("scoreToLevel: 50-74 → high", () => {
  assert.equal(scoreToLevel(50), "high");
  assert.equal(scoreToLevel(74), "high");
});

test("scoreToLevel: 75-100 → critical", () => {
  assert.equal(scoreToLevel(75), "critical");
  assert.equal(scoreToLevel(100), "critical");
});

test("computeRisk: no factors → score 0, level low", () => {
  const r = computeRisk([]);
  assert.equal(r.score, 0);
  assert.equal(r.level, "low");
  assert.equal(r.requiresPermit, false);
});

test("computeRisk: untriggered factors don't add to score", () => {
  const factors = [
    factor("f1", "Heavy load", 0.5, false),
    factor("f2", "Structural", 0.3, false),
  ];
  const r = computeRisk(factors);
  assert.equal(r.score, 0);
  assert.equal(r.level, "low");
});

test("computeRisk: triggered factors sum to score", () => {
  const factors = [
    factor("f1", "Structural change", 0.30, true),
    factor("f2", "Height > 12ft", 0.25, true),
  ];
  const r = computeRisk(factors);
  assert.equal(r.score, 55); // 0.55 * 100 = 55
  assert.equal(r.level, "high");
});

test("computeRisk: score capped at 100", () => {
  const factors = Array.from({ length: 5 }, (_, i) =>
    factor(`f${i}`, `Factor ${i}`, 0.30, true)
  );
  const r = computeRisk(factors);
  assert.equal(r.score, 100);
});

test("computeRisk: requiresPermit at score >= 50", () => {
  const f = [factor("f1", "Major", 0.50, true)];
  assert.equal(computeRisk(f).requiresPermit, true);
  const low = [factor("f1", "Minor", 0.10, true)];
  assert.equal(computeRisk(low).requiresPermit, false);
});

test("computeRisk: requiresEngineering at score >= 80", () => {
  const f = [factor("f1", "Structural", 0.80, true)];
  assert.equal(computeRisk(f).requiresEngineering, true);
  const mid = [factor("f1", "Mid", 0.50, true)];
  assert.equal(computeRisk(mid).requiresEngineering, false);
});

test("computeRisk: overrides take precedence over defaults", () => {
  const factors = [factor("f1", "Low risk", 0.10, true)]; // score=10
  const r = computeRisk(factors, { requiresPermit: true, requiresEngineering: true });
  assert.equal(r.requiresPermit, true);
  assert.equal(r.requiresEngineering, true);
  assert.equal(r.score, 10); // score unchanged
});

test("factor: creates correct RiskFactor shape", () => {
  const f = factor("structural", "Structural change", 0.35, true, "Load bearing wall");
  assert.equal(f.id, "structural");
  assert.equal(f.weight, 0.35);
  assert.equal(f.triggered, true);
  assert.equal(f.reason, "Load bearing wall");
});

test("computeRisk: mixed triggered and untriggered → only triggered count", () => {
  const factors = [
    factor("f1", "Heavy", 0.40, true),
    factor("f2", "Structural", 0.40, false),
  ];
  const r = computeRisk(factors);
  assert.equal(r.score, 40);
  assert.equal(r.level, "medium");
});
