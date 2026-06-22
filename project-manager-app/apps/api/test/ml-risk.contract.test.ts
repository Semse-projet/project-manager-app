import test from "node:test";
import assert from "node:assert/strict";

type ProjectOutcome = {
  projectId: string;
  trade: string;
  region: string;
  estimatedCost: number;
  actualCost: number;
  estimatedDays: number;
  actualDays: number;
  disputeOpened: boolean;
  paymentDelayDays: number;
  evidenceCompleteness: number;
  status: "completed" | "cancelled" | "incomplete";
};

function extractEligibleOutcomes(outcomes: ProjectOutcome[]): ProjectOutcome[] {
  return outcomes.filter((outcome) => outcome.status === "completed" && !outcome.disputeOpened && outcome.evidenceCompleteness >= 80);
}

function aggregateWithMinimumSampleSize(outcomes: ProjectOutcome[], minSampleSize: number) {
  const eligible = extractEligibleOutcomes(outcomes);
  if (eligible.length < minSampleSize) {
    return { mode: "insufficient_data" as const, sampleSize: eligible.length, confidence: 0 };
  }
  return {
    mode: "benchmark" as const,
    sampleSize: eligible.length,
    confidence: Math.min(0.99, eligible.length / (eligible.length + 5)),
  };
}

function benchmarkExplanation(input: { sampleSize: number; confidence: number }): string {
  return `Benchmark built from ${input.sampleSize} project(s) with ${Math.round(input.confidence * 100)}% confidence.`;
}

function fallbackToRuleBasedRisk(sampleSize: number): "rule_based" | "ml" {
  return sampleSize < 5 ? "rule_based" : "ml";
}

test("M5.1 outcome extraction excludes incomplete or cancelled projects", () => {
  const eligible = extractEligibleOutcomes([
    { projectId: "p1", trade: "paint", region: "TX", estimatedCost: 100, actualCost: 120, estimatedDays: 2, actualDays: 3, disputeOpened: false, paymentDelayDays: 0, evidenceCompleteness: 90, status: "completed" },
    { projectId: "p2", trade: "paint", region: "TX", estimatedCost: 100, actualCost: 120, estimatedDays: 2, actualDays: 3, disputeOpened: true, paymentDelayDays: 0, evidenceCompleteness: 90, status: "completed" },
    { projectId: "p3", trade: "paint", region: "TX", estimatedCost: 100, actualCost: 120, estimatedDays: 2, actualDays: 3, disputeOpened: false, paymentDelayDays: 0, evidenceCompleteness: 90, status: "cancelled" },
  ]);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]?.projectId, "p1");
});

test("M5.1 aggregation respects minimum sample size", () => {
  const result = aggregateWithMinimumSampleSize([
    { projectId: "p1", trade: "paint", region: "TX", estimatedCost: 100, actualCost: 120, estimatedDays: 2, actualDays: 3, disputeOpened: false, paymentDelayDays: 0, evidenceCompleteness: 90, status: "completed" },
    { projectId: "p2", trade: "paint", region: "TX", estimatedCost: 100, actualCost: 120, estimatedDays: 2, actualDays: 3, disputeOpened: false, paymentDelayDays: 0, evidenceCompleteness: 90, status: "completed" },
  ], 3);
  assert.equal(result.mode, "insufficient_data");
  assert.equal(result.sampleSize, 2);
});

test("M5.1 prediction returns insufficient_data when sample is too small", () => {
  const result = aggregateWithMinimumSampleSize([
    { projectId: "p1", trade: "paint", region: "TX", estimatedCost: 100, actualCost: 120, estimatedDays: 2, actualDays: 3, disputeOpened: false, paymentDelayDays: 0, evidenceCompleteness: 90, status: "completed" },
  ], 3);
  assert.equal(result.mode, "insufficient_data");
  assert.equal(result.confidence, 0);
});

test("M5.1 benchmark explanation includes sample size and confidence", () => {
  const explanation = benchmarkExplanation({ sampleSize: 8, confidence: 0.82 });
  assert.ok(explanation.includes("8 project(s)"));
  assert.ok(explanation.includes("82% confidence"));
});

test("M5.1 fallback to rule-based risk is used when sample size is insufficient", () => {
  assert.equal(fallbackToRuleBasedRisk(2), "rule_based");
  assert.equal(fallbackToRuleBasedRisk(8), "ml");
});
