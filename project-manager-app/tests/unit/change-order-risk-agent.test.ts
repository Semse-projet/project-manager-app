/**
 * Unit tests for change-order risk scoring logic — pure functions, no DB.
 * Run: node --experimental-strip-types --test tests/unit/change-order-risk-agent.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

type RiskLevel = "low" | "medium" | "high" | "critical";
type PaymentImpact = "none" | "requires_approval" | "hold_required" | "already_applied";

type ImpactResult = {
  costDeltaAvg: number;
  riskLevel: RiskLevel;
  paymentImpact: PaymentImpact;
  affectedMilestones: string[];
};

type ChangeOrderInput = {
  title: string;
  description?: string;
  trigger?: string;
  probability?: number | null;
};

function scoreChangeOrderRisk(co: ChangeOrderInput, impact: ImpactResult): {
  riskLevel: RiskLevel;
  flags: string[];
  score: number;
} {
  const flags: string[] = [];
  let score = 0;

  if (impact.costDeltaAvg > 5000) { flags.push("High cost delta — exceeds $5,000 threshold"); score += 30; }
  else if (impact.costDeltaAvg > 1000) { flags.push("Moderate cost delta"); score += 15; }

  if (impact.riskLevel === "critical") { flags.push("Upstream risk engine flagged as critical"); score += 35; }
  else if (impact.riskLevel === "high") { flags.push("Upstream risk engine flagged as high"); score += 20; }

  if (impact.paymentImpact === "hold_required") { flags.push("Payment hold required before proceeding"); score += 20; }
  else if (impact.paymentImpact === "requires_approval") { flags.push("Additional approval required for payment release"); score += 10; }

  if (impact.affectedMilestones.length > 2) { flags.push(`Affects ${impact.affectedMilestones.length} milestones — schedule impact likely`); score += 15; }

  const trigger = (co.trigger ?? "").toLowerCase();
  if (trigger.includes("hidden") || trigger.includes("damage") || trigger.includes("unforeseen")) {
    flags.push("Triggered by unforeseen condition — scope may expand further"); score += 10;
  }

  if (co.probability !== null && co.probability !== undefined && co.probability < 0.5) {
    flags.push(`Low probability (${Math.round(co.probability * 100)}%) — verify necessity before approving`); score += 5;
  }

  const riskLevel: RiskLevel =
    score >= 60 ? "critical" : score >= 35 ? "high" : score >= 15 ? "medium" : "low";

  return { riskLevel, flags, score };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test("low cost + low risk → low risk level", () => {
  const result = scoreChangeOrderRisk(
    { title: "Minor scope", probability: 0.8 },
    { costDeltaAvg: 500, riskLevel: "low", paymentImpact: "none", affectedMilestones: [] },
  );
  assert.equal(result.riskLevel, "low");
  assert.equal(result.flags.length, 0);
});

test("high cost delta alone → medium risk", () => {
  const result = scoreChangeOrderRisk(
    { title: "Extra materials" },
    { costDeltaAvg: 2000, riskLevel: "low", paymentImpact: "none", affectedMilestones: [] },
  );
  assert.equal(result.riskLevel, "medium");
  assert.ok(result.flags.some(f => f.includes("Moderate cost delta")));
});

test("cost > 5000 + upstream critical → critical", () => {
  const result = scoreChangeOrderRisk(
    { title: "Major rework" },
    { costDeltaAvg: 8000, riskLevel: "critical", paymentImpact: "hold_required", affectedMilestones: ["m1", "m2", "m3"] },
  );
  assert.equal(result.riskLevel, "critical");
  assert.ok(result.score >= 60);
  assert.ok(result.flags.length >= 3);
});

test("upstream high + payment hold → high risk", () => {
  const result = scoreChangeOrderRisk(
    { title: "Plumbing repair" },
    { costDeltaAvg: 800, riskLevel: "high", paymentImpact: "hold_required", affectedMilestones: [] },
  );
  assert.equal(result.riskLevel, "high");
  assert.ok(result.flags.some(f => f.includes("hold required")));
});

test("unforeseen trigger adds risk flag", () => {
  const result = scoreChangeOrderRisk(
    { title: "Hidden damage repair", trigger: "hidden damage discovered behind wall" },
    { costDeltaAvg: 0, riskLevel: "low", paymentImpact: "none", affectedMilestones: [] },
  );
  assert.ok(result.flags.some(f => f.includes("unforeseen condition")));
});

test("low probability adds caution flag", () => {
  const result = scoreChangeOrderRisk(
    { title: "Optional upgrade", probability: 0.3 },
    { costDeltaAvg: 0, riskLevel: "low", paymentImpact: "none", affectedMilestones: [] },
  );
  assert.ok(result.flags.some(f => f.includes("30%")));
});

test("many affected milestones adds schedule flag", () => {
  const result = scoreChangeOrderRisk(
    { title: "Scope expansion" },
    { costDeltaAvg: 0, riskLevel: "low", paymentImpact: "none", affectedMilestones: ["m1", "m2", "m3", "m4"] },
  );
  assert.ok(result.flags.some(f => f.includes("4 milestones")));
});

test("requires_approval adds moderate flag", () => {
  const result = scoreChangeOrderRisk(
    { title: "Electrical upgrade" },
    { costDeltaAvg: 0, riskLevel: "low", paymentImpact: "requires_approval", affectedMilestones: [] },
  );
  assert.ok(result.flags.some(f => f.includes("Additional approval")));
});

test("zero cost + low risk + high probability → score 0, no flags", () => {
  const result = scoreChangeOrderRisk(
    { title: "Documentation update", probability: 0.9 },
    { costDeltaAvg: 0, riskLevel: "low", paymentImpact: "none", affectedMilestones: [] },
  );
  assert.equal(result.score, 0);
  assert.equal(result.flags.length, 0);
  assert.equal(result.riskLevel, "low");
});
