import test from "node:test";
import assert from "node:assert/strict";
import { calculateSiding } from "../../../packages/tools/dist/index.js";
import type { SidingInput } from "../../../packages/tools/dist/index.js";

function base(overrides: Partial<SidingInput> = {}): SidingInput {
  return {
    wallSqFt: 1800, stories: 1, sidingType: "vinyl",
    removeOldSiding: false, windowCount: 8, doorCount: 2,
    corners: 4, visibleWaterDamage: false, houseWrapIncluded: true,
    flashingCondition: "good", soffitFasciaIncluded: false,
    clientProvidesMaterials: false, mode: "professional",
    ...overrides,
  };
}

test("siding basic vinyl installation returns valid result", () => {
  const r = calculateSiding(base());
  assert.ok(r.isValid);
  assert.ok(r.costs.total > 0);
  assert.equal(r.trade, "siding");
  assert.ok(r.milestones.length >= 2);
});

test("siding with water damage raises risk score", () => {
  const clean = calculateSiding(base({ visibleWaterDamage: false }));
  const damaged = calculateSiding(base({ visibleWaterDamage: true }));
  assert.ok(damaged.risk.score > clean.risk.score, `damaged (${damaged.risk.score}) > clean (${clean.risk.score})`);
  assert.ok(damaged.warnings.some(w => w.toLowerCase().includes("water")));
});

test("siding removal creates inspection gate in scope", () => {
  const r = calculateSiding(base({ removeOldSiding: true }));
  assert.ok(r.scope?.changeOrderTriggers.some(t => t.includes("removal")));
  assert.ok(r.warnings.some(w => w.toLowerCase().includes("inspection gate")));
});

test("two-story siding costs more than single story", () => {
  const single = calculateSiding(base({ stories: 1 }));
  const double = calculateSiding(base({ stories: 2 }));
  assert.ok(double.costs.total > single.costs.total, `2-story (${double.costs.total}) > 1-story (${single.costs.total})`);
  assert.ok(double.risk.score > single.risk.score);
});

test("fiber cement siding has higher labor than vinyl", () => {
  const vinyl = calculateSiding(base({ sidingType: "vinyl" }));
  const fc    = calculateSiding(base({ sidingType: "fiber_cement" }));
  assert.ok(fc.costs.labor > vinyl.costs.labor, `fiber_cement labor (${fc.costs.labor}) > vinyl (${vinyl.costs.labor})`);
});

test("unknown flashing condition generates warning and raises risk", () => {
  const good    = calculateSiding(base({ flashingCondition: "good" }));
  const unknown = calculateSiding(base({ flashingCondition: "unknown" }));
  assert.ok(unknown.risk.score > good.risk.score);
  assert.ok(unknown.validationIssues.some(i => i.field === "flashingCondition"));
});

test("poor flashing generates higher risk than unknown", () => {
  const unknown = calculateSiding(base({ flashingCondition: "unknown" }));
  const poor    = calculateSiding(base({ flashingCondition: "poor" }));
  assert.ok(poor.risk.score > unknown.risk.score);
});

test("siding with water damage + removal = high or critical risk", () => {
  const r = calculateSiding(base({ visibleWaterDamage: true, removeOldSiding: true, flashingCondition: "poor" }));
  assert.ok(r.risk.level === "high" || r.risk.level === "critical", `Expected high/critical, got ${r.risk.level}`);
});

test("siding confidence score lower without photos", () => {
  const r = calculateSiding(base({ flashingCondition: "unknown" }));
  assert.ok(r.confidenceScore !== undefined);
  assert.ok(r.confidenceScore!.score < 80, `Expected confidence < 80, got ${r.confidenceScore!.score}`);
});

test("siding dispute risk lower with good scope", () => {
  const clean = calculateSiding(base({ flashingCondition: "good", visibleWaterDamage: false }));
  const risky = calculateSiding(base({ flashingCondition: "unknown", visibleWaterDamage: true, clientProvidesMaterials: true }));
  assert.ok(risky.disputeRisk!.score > clean.disputeRisk!.score);
});

test("siding has price bands with low < mid < high", () => {
  const r = calculateSiding(base());
  assert.ok(r.priceBands?.low  < r.priceBands?.mid);
  assert.ok(r.priceBands?.mid  < r.priceBands?.high);
});

test("siding has production schedule with phases", () => {
  const r = calculateSiding(base({ removeOldSiding: true }));
  assert.ok(r.productionSchedule?.phases.length >= 3);
  assert.ok(r.productionSchedule?.totalDaysMin > 0);
});

test("siding scope has included and excluded items", () => {
  const r = calculateSiding(base());
  assert.ok(r.scope!.included.length > 0);
  assert.ok(r.scope!.excluded.length > 0);
  assert.ok(r.scope!.changeOrderTriggers.length > 0);
});

test("siding has 90-day inspection requirement if remove+water damage", () => {
  const r = calculateSiding(base({ removeOldSiding: true, visibleWaterDamage: true }));
  assert.ok(r.risk.requiresInspection);
});

test("siding algorithm trace has triggered rules for water damage", () => {
  const r = calculateSiding(base({ visibleWaterDamage: true }));
  assert.ok(r.algorithmTrace?.rulesTriggered.some(rule => rule.ruleId === "WATER_DAMAGE_RISK"));
});
