import test from "node:test";
import assert from "node:assert/strict";
import {
  generateEstimate,
  generateMilestones,
  buildLiveSummary,
  buildInitialIntake,
} from "../dist/modules/smart-intake/smart-intake.logic.js";

function makeIntake(overrides: Record<string, unknown> = {}) {
  const base = buildInitialIntake({
    id: "test_intake_1",
    tenantId: "t1",
    sessionToken: "sess1",
    rawDescription: overrides.rawDescription as string ?? "Need help with my home",
    ...overrides,
  });
  // Inject detectedCategory override if specified
  if (overrides.detectedCategory) {
    return { ...base, detectedCategory: overrides.detectedCategory, answers: overrides.answers ?? [] } as typeof base;
  }
  if (overrides.answers) {
    return { ...base, answers: overrides.answers } as typeof base;
  }
  return base;
}

function answer(questionId: string, values: string[]) {
  return { questionId, selectedValues: values, isNotSure: false, answeredAt: new Date().toISOString() };
}

// ── interior_painting uses painting estimator ──────────────────────────────

test("interior_painting estimate uses painting rates and has preparation breakdown", () => {
  const intake = makeIntake({ rawDescription: "Pintar la sala con 2 capas" });
  assert.equal(intake.detectedCategory, "interior_painting");
  const est = generateEstimate(intake);
  assert.ok(est.breakdown.preparation !== undefined, "painting estimate should include preparation");
  assert.ok(est.totalRange.min > 0);
  assert.equal(est.generatedBy, "smart_intake_formula");
});

// ── exterior_painting uses painting estimator ──────────────────────────────

test("exterior_painting estimate is derived from painting estimator (no preparation? skipped)", () => {
  const intake = makeIntake({ rawDescription: "Paint the exterior of my house and siding" });
  assert.equal(intake.detectedCategory, "exterior_painting");
  const est = generateEstimate(intake);
  assert.ok(est.totalRange.min > 0);
  assert.equal(est.generatedBy, "smart_intake_formula");
});

// ── drywall_repair generic estimator ─────────────────────────────────────────

test("drywall_repair estimate uses generic sqft estimator", () => {
  const intake = makeIntake({
    rawDescription: "I have a hole in my drywall that needs repair",
    answers: [
      answer("drywall_type", ["repair"]),
      answer("drywall_area", ["10_100_sqft"]),
    ],
  });
  assert.equal(intake.detectedCategory, "drywall_repair");
  const est = generateEstimate(intake);
  // drywall rate is $2.5–$5.5/sqft, area 10–100 sqft → min should be > 150 (fallback)
  assert.ok(est.totalRange.min >= 150, `Expected min >= 150, got ${est.totalRange.min}`);
  assert.ok(est.totalRange.max >= est.totalRange.min);
  assert.equal(est.breakdown.preparation, undefined, "generic estimator has no preparation line");
});

test("drywall_repair with 'over_500_sqft' uses high complexity rates", () => {
  const intake = makeIntake({
    rawDescription: "Large drywall installation project",
    answers: [
      answer("drywall_type", ["new_install"]),
      answer("drywall_area", ["over_500_sqft"]),
    ],
  });
  const est = generateEstimate(intake);
  // 500–900 sqft × $2.5 × 1.6 (high complexity) = 2000+ min
  assert.ok(est.totalRange.min >= 500, `Expected large project, got ${est.totalRange.min}`);
});

// ── bathroom_remodel fixed estimator ──────────────────────────────────────────

test("bathroom_remodel estimate returns range within registry bounds", () => {
  const intake = makeIntake({
    rawDescription: "Full bathroom remodel with new tile and shower",
    answers: [
      answer("bathroom_scope", ["full_remodel"]),
      answer("bathroom_size", ["medium"]),
      answer("bathroom_materials", ["standard"]),
    ],
  });
  assert.equal(intake.detectedCategory, "bathroom_remodel");
  const est = generateEstimate(intake);
  // fallback min is $3000
  assert.ok(est.totalRange.min >= 3000, `Expected >= 3000, got ${est.totalRange.min}`);
  assert.ok(est.totalRange.max > est.totalRange.min);
});

test("bathroom_remodel premium materials increases estimate vs budget", () => {
  const baseFx = makeIntake({
    rawDescription: "Remodelar el baño principal",
    answers: [answer("bathroom_scope", ["cosmetic"]), answer("bathroom_size", ["medium"]), answer("bathroom_materials", ["budget"])],
  });
  const premiumFx = makeIntake({
    rawDescription: "Remodelar el baño principal",
    answers: [answer("bathroom_scope", ["full_remodel"]), answer("bathroom_size", ["large"]), answer("bathroom_materials", ["premium"])],
  });
  const baseEst = generateEstimate(baseFx);
  const premiumEst = generateEstimate(premiumFx);
  assert.ok(premiumEst.totalRange.min >= baseEst.totalRange.min,
    `Premium (${premiumEst.totalRange.min}) should be >= budget (${baseEst.totalRange.min})`);
});

// ── kitchen_remodel fixed estimator ──────────────────────────────────────────

test("kitchen_remodel estimate within registry bounds", () => {
  const intake = makeIntake({
    rawDescription: "Kitchen renovation with new cabinets and countertops",
    answers: [
      answer("kitchen_scope", ["full_remodel"]),
      answer("kitchen_size", ["medium"]),
      answer("kitchen_materials", ["standard"]),
    ],
  });
  assert.equal(intake.detectedCategory, "kitchen_remodel");
  const est = generateEstimate(intake);
  assert.ok(est.totalRange.min >= 5000, `Expected >= 5000, got ${est.totalRange.min}`);
});

// ── cleaning hourly estimator ─────────────────────────────────────────────────

test("cleaning estimate uses hourly rates within expected range", () => {
  const intake = makeIntake({
    rawDescription: "I need a deep clean of my house",
    answers: [
      answer("cleaning_type", ["deep"]),
      answer("cleaning_size", ["1000_2000"]),
    ],
  });
  assert.equal(intake.detectedCategory, "cleaning");
  const est = generateEstimate(intake);
  // 5–10h × 1.6 (deep) × $25–$60 = 200–960
  assert.ok(est.totalRange.min >= 100, `Expected >= 100, got ${est.totalRange.min}`);
  assert.ok(est.totalRange.max <= 1600, `Expected reasonable max for deep clean 1000-2000sqft, got ${est.totalRange.max}`);
});

// ── general_carpentry fixed estimator ────────────────────────────────────────

test("general_carpentry estimate within fallback range minimum", () => {
  const intake = makeIntake({
    rawDescription: "Install new doors and windows",
    answers: [
      answer("carpentry_type", ["doors"]),
      answer("carpentry_units", ["medium"]),
      answer("carpentry_material", ["standard"]),
    ],
  });
  assert.equal(intake.detectedCategory, "general_carpentry");
  const est = generateEstimate(intake);
  assert.ok(est.totalRange.min >= 500, `Expected >= 500 (fallback), got ${est.totalRange.min}`);
});

// ── generateMilestones dispatches correctly ───────────────────────────────────

test("interior_painting milestones use painting templates (>= 2 milestones)", () => {
  const intake = makeIntake({ rawDescription: "Paint my room" });
  const ms = generateMilestones(intake);
  assert.ok(ms.length >= 2, `Expected >= 2 painting milestones, got ${ms.length}`);
  assert.ok(ms.every(m => typeof m.paymentPercentage === "number"));
  const totalPct = ms.reduce((s, m) => s + (m.paymentPercentage ?? 0), 0);
  assert.equal(totalPct, 100, `Payment percentages should sum to 100, got ${totalPct}`);
});

test("bathroom_remodel milestones use HIGH_VALUE_MILESTONES (4 milestones)", () => {
  const intake = makeIntake({ rawDescription: "Full bathroom remodel with new shower" });
  const ms = generateMilestones(intake);
  // HIGH_VALUE_MILESTONES has 4 steps
  assert.equal(ms.length, 4, `Expected 4 high-value milestones, got ${ms.length}`);
  const totalPct = ms.reduce((s, m) => s + (m.paymentPercentage ?? 0), 0);
  assert.equal(totalPct, 100);
});

test("cleaning milestones use 2-step template", () => {
  const intake = makeIntake({ rawDescription: "Deep cleaning of my apartment" });
  const ms = generateMilestones(intake);
  assert.equal(ms.length, 2, `Expected 2 cleaning milestones, got ${ms.length}`);
  const totalPct = ms.reduce((s, m) => s + (m.paymentPercentage ?? 0), 0);
  assert.equal(totalPct, 100);
});

test("drywall_repair milestones use STANDARD_MILESTONES (3 milestones)", () => {
  const intake = makeIntake({ rawDescription: "Fix the drywall in my bedroom" });
  const ms = generateMilestones(intake);
  assert.equal(ms.length, 3, `Expected 3 standard milestones, got ${ms.length}`);
});

// ── buildLiveSummary uses correct category label ──────────────────────────────

test("buildLiveSummary returns 'Interior painting' for interior_painting", () => {
  const intake = makeIntake({ rawDescription: "Paint my bedroom walls" });
  const summary = buildLiveSummary(intake);
  assert.equal(summary.category, "Interior painting");
});

test("buildLiveSummary returns 'Bathroom remodel' for bathroom_remodel", () => {
  const intake = makeIntake({ rawDescription: "Remodel my bathroom with new shower" });
  const summary = buildLiveSummary(intake);
  assert.equal(summary.category, "Bathroom remodel");
});

test("buildLiveSummary returns 'Cleaning' for cleaning category", () => {
  const intake = makeIntake({ rawDescription: "Deep cleaning of my house" });
  const summary = buildLiveSummary(intake);
  assert.equal(summary.category, "Cleaning");
});
