import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAccuracyScore,
  getAccuracyDetail,
  getMissingFields,
  getRecommendedFields,
  buildInitialIntake,
} from "../dist/modules/smart-intake/smart-intake.logic.js";
import { getScoringProfile, GENERIC_SCORING_PROFILE } from "../dist/modules/smart-intake/config/scoring-profiles.js";

function uid() { return `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

function makeIntake(rawDescription: string, categoryId?: string, subcategoryId?: string) {
  return buildInitialIntake({
    id: `intk_${uid()}`,
    tenantId: "t_test",
    sessionToken: `sess_${uid()}`,
    rawDescription,
    selectedCategoryId: categoryId ?? null,
    selectedSubcategoryId: subcategoryId ?? null,
  });
}

function withAnswers(intake: ReturnType<typeof makeIntake>, answers: Array<{ questionId: string; values: string[]; notSure?: boolean }>) {
  return {
    ...intake,
    answers: answers.map(a => ({
      questionId: a.questionId,
      selectedValues: a.values,
      isNotSure: a.notSure ?? false,
      answeredAt: new Date().toISOString(),
    })),
  };
}

// ── interior_painting — unchanged detailed scoring ─────────────────────────────

test("interior_painting score=15 with only description", () => {
  const intake = makeIntake("Pintar la sala con pintura blanca");
  assert.equal(intake.detectedCategory, "interior_painting");
  assert.equal(calculateAccuracyScore(intake), 15);
});

test("interior_painting is NOT unlocked with score=15", () => {
  const intake = makeIntake("Pintar la sala con pintura blanca");
  const detail = getAccuracyDetail(intake);
  assert.equal(detail.estimateReady, false);
  assert.equal(detail.category, "interior_painting");
});

test("interior_painting missingFields uses painting-specific IDs", () => {
  const intake = makeIntake("Paint the bedroom walls");
  const missing = getMissingFields(intake);
  assert.ok(missing.includes("area"), "area should be missing");
  assert.ok(missing.includes("condition"), "condition should be missing");
});

test("interior_painting does NOT use generic profile weights", () => {
  const profile = getScoringProfile("interior_painting" as any);
  // painting falls through to GENERIC_SCORING_PROFILE (no specific profile)
  assert.deepEqual(profile, GENERIC_SCORING_PROFILE);
});

// ── exterior_painting — question-based scoring ────────────────────────────────

test("exterior_painting score increases when questions answered", () => {
  const base = makeIntake("Paint the exterior siding", "pintura", "exterior");
  const scored = withAnswers(base, [
    { questionId: "ext_painting_surface", values: ["siding"] },
    { questionId: "ext_painting_area",    values: ["500_1000_sqft"] },
    { questionId: "ext_painting_condition", values: ["good"] },
  ]);
  const score = calculateAccuracyScore(scored);
  assert.ok(score > 36, `Expected > 36 (threshold), got ${score}`);
});

test("exterior_painting estimateReady=true after answering critical questions", () => {
  const base = makeIntake("Paint the exterior of my house", "pintura", "exterior");
  const scored = withAnswers(base, [
    { questionId: "ext_painting_surface",  values: ["siding"] },
    { questionId: "ext_painting_area",     values: ["1000_2000_sqft"] },
    { questionId: "ext_painting_condition", values: ["peeling"] },
  ]);
  const detail = getAccuracyDetail(scored);
  assert.ok(detail.estimateReady, `Expected estimateReady, score=${detail.score}`);
});

test("exterior_painting riskFlags populated for scaffolding", () => {
  const base = makeIntake("Exterior paint 3-story house", "pintura", "exterior");
  const scored = withAnswers(base, [
    { questionId: "ext_painting_access", values: ["scaffolding"] },
  ]);
  const detail = getAccuracyDetail(scored);
  assert.ok(detail.riskFlags.includes("elevated_access_required"));
});

// ── drywall_repair scoring ─────────────────────────────────────────────────────

test("drywall_repair score=15 with only description", () => {
  const intake = makeIntake("Fix the drywall hole in my bedroom wall sheetrock", "drywall");
  assert.equal(intake.detectedCategory, "drywall_repair");
  assert.equal(calculateAccuracyScore(intake), 15);
});

test("drywall_repair threshold is 36 (not painting's 36)", () => {
  const profile = getScoringProfile("drywall_repair");
  assert.equal(profile.estimateReadyThreshold, 36);
});

test("drywall_repair estimateReady after type + area", () => {
  const base = makeIntake("Drywall repair project", "drywall");
  const scored = withAnswers(base, [
    { questionId: "drywall_type", values: ["repair"] },
    { questionId: "drywall_area", values: ["10_100_sqft"] },
  ]);
  const detail = getAccuracyDetail(scored);
  assert.ok(detail.estimateReady, `Expected estimateReady, score=${detail.score}`);
});

test("drywall_repair missingCriticalFields shows unanswered critical questions", () => {
  const base = makeIntake("Fix the drywall in bedroom", "drywall");
  // Only answer type, not area or condition
  const scored = withAnswers(base, [
    { questionId: "drywall_type", values: ["repair"] },
  ]);
  const detail = getAccuracyDetail(scored);
  assert.ok(detail.missingCriticalFields.includes("drywall_area"), "area should be critical missing");
});

test("drywall_repair riskFlags for structural cracks", () => {
  const base = makeIntake("Structural crack in drywall", "drywall");
  const scored = withAnswers(base, [
    { questionId: "drywall_condition", values: ["structural"] },
  ]);
  const detail = getAccuracyDetail(scored);
  assert.ok(detail.riskFlags.includes("structural_crack_risk"));
});

// ── bathroom_remodel — higher threshold ────────────────────────────────────────

test("bathroom_remodel threshold is 45 (higher than painting)", () => {
  const profile = getScoringProfile("bathroom_remodel");
  assert.equal(profile.estimateReadyThreshold, 45);
});

test("bathroom_remodel NOT estimateReady with only description", () => {
  const intake = makeIntake("Full bathroom remodel with new shower", "bano");
  assert.equal(intake.detectedCategory, "bathroom_remodel");
  const detail = getAccuracyDetail(intake);
  assert.equal(detail.estimateReady, false);
});

test("bathroom_remodel estimateReady after scope + size + plumbing", () => {
  const base = makeIntake("Bathroom remodel", "bano");
  const scored = withAnswers(base, [
    { questionId: "bathroom_scope",    values: ["full_remodel"] },
    { questionId: "bathroom_size",     values: ["medium"] },
    { questionId: "bathroom_plumbing", values: ["no_move"] },
  ]);
  const detail = getAccuracyDetail(scored);
  assert.ok(detail.estimateReady, `Expected estimateReady, score=${detail.score}`);
});

test("bathroom_remodel riskFlags for plumbing relocation", () => {
  const base = makeIntake("Remodel bathroom moving pipes", "bano");
  const scored = withAnswers(base, [
    { questionId: "bathroom_plumbing", values: ["relocate"] },
  ]);
  const detail = getAccuracyDetail(scored);
  assert.ok(detail.riskFlags.includes("plumbing_relocation"));
});

// ── kitchen_remodel — highest threshold ────────────────────────────────────────

test("kitchen_remodel threshold is 45", () => {
  const profile = getScoringProfile("kitchen_remodel");
  assert.equal(profile.estimateReadyThreshold, 45);
});

test("kitchen_remodel NOT estimateReady after 1 question", () => {
  const base = makeIntake("New kitchen renovation cabinets countertops", "cocina");
  const scored = withAnswers(base, [
    { questionId: "kitchen_scope", values: ["full_remodel"] },
  ]);
  const detail = getAccuracyDetail(scored);
  assert.equal(detail.estimateReady, false, `Score=${detail.score} should not unlock estimate with 1 answer`);
});

test("kitchen_remodel estimateReady after 3 critical answers", () => {
  const base = makeIntake("Kitchen renovation project", "cocina");
  const scored = withAnswers(base, [
    { questionId: "kitchen_scope",     values: ["full_remodel"] },
    { questionId: "kitchen_size",      values: ["medium"] },
    { questionId: "kitchen_appliances",values: ["no_appliances"] },
    { questionId: "kitchen_materials", values: ["standard"] },
  ]);
  const detail = getAccuracyDetail(scored);
  assert.ok(detail.estimateReady, `Expected estimateReady, score=${detail.score}`);
});

// ── cleaning — lowest threshold ────────────────────────────────────────────────

test("cleaning threshold is 30 (simplest service)", () => {
  const profile = getScoringProfile("cleaning");
  assert.equal(profile.estimateReadyThreshold, 30);
});

test("cleaning unlocks estimate with fewer answers than bathroom needs", () => {
  // Cleaning: 1 critical question is enough to cross threshold 30 (type=25 + desc=15 = 40)
  const cleaningBase = makeIntake("Clean my apartment", "limpieza");
  const cleaningScored = withAnswers(cleaningBase, [
    { questionId: "cleaning_type", values: ["deep"] },
  ]);
  const cleaningDetail = getAccuracyDetail(cleaningScored);

  // Bathroom: 1 critical question NOT enough (scope=25 + desc=15 = 40, threshold=45)
  const bathroomBase = makeIntake("Remodel the bathroom full gut", "bano");
  const bathroomScored = withAnswers(bathroomBase, [
    { questionId: "bathroom_scope", values: ["full_remodel"] },
  ]);
  const bathroomDetail = getAccuracyDetail(bathroomScored);

  assert.ok(cleaningDetail.estimateReady, `Cleaning should be ready with 1 answer, score=${cleaningDetail.score}`);
  assert.equal(bathroomDetail.estimateReady, false, `Bathroom should NOT be ready with 1 answer, score=${bathroomDetail.score}`);
});

// ── general_carpentry scoring ──────────────────────────────────────────────────

test("general_carpentry estimateReady after type + units", () => {
  const base = makeIntake("Install new doors and windows", "carpinteria");
  const scored = withAnswers(base, [
    { questionId: "carpentry_type",  values: ["doors"] },
    { questionId: "carpentry_units", values: ["medium"] },
  ]);
  const detail = getAccuracyDetail(scored);
  assert.ok(detail.estimateReady, `Expected estimateReady, score=${detail.score}`);
});

// ── generic fallback ───────────────────────────────────────────────────────────

test("unknown category falls back to GENERIC_SCORING_PROFILE", () => {
  const profile = getScoringProfile("interior_painting" as any);
  // interior_painting has no specific profile → returns generic
  assert.deepEqual(profile, GENERIC_SCORING_PROFILE);
});

test("generic profile has empty weights and baseScore=20", () => {
  assert.equal(GENERIC_SCORING_PROFILE.rawDescriptionScore, 20);
  assert.equal(GENERIC_SCORING_PROFILE.weights.length, 0);
});

// ── cross-category: not using painting weights for non-painting ────────────────

test("painting field IDs (painting_area, painting_condition) do not affect drywall score", () => {
  const drywallBase = makeIntake("Fix drywall in bedroom", "drywall");
  // Add fake painting answer IDs — should not affect drywall score
  const withPaintingAnswers = withAnswers(drywallBase, [
    { questionId: "painting_area",      values: ["250_500_sqft"] },
    { questionId: "painting_condition", values: ["good"] },
    { questionId: "painting_coats",     values: ["2"] },
  ]);
  const scoreWithFakeAnswers = calculateAccuracyScore(withPaintingAnswers);

  const emptyDrywall = makeIntake("Fix drywall in bedroom", "drywall");
  const baseScore = calculateAccuracyScore(emptyDrywall);

  // Painting question IDs should NOT contribute to drywall score
  assert.equal(scoreWithFakeAnswers, baseScore, "Painting answer IDs should not affect drywall score");
});

// ── getRecommendedFields dispatch ─────────────────────────────────────────────

test("getRecommendedFields for exterior_painting returns optional question IDs", () => {
  const base = makeIntake("Exterior paint project", "pintura", "exterior");
  const recommended = getRecommendedFields(base);
  assert.ok(Array.isArray(recommended));
  // extCoats and access are recommended but not critical
  assert.ok(recommended.includes("ext_painting_coats") || recommended.includes("ext_painting_access"),
    `Expected coats or access in recommended: ${JSON.stringify(recommended)}`);
});

test("getRecommendedFields for interior_painting returns painting-specific IDs", () => {
  const base = makeIntake("Paint the living room", "pintura", "interior");
  const recommended = getRecommendedFields(base);
  assert.ok(recommended.some(f => ["pricingMode", "durationPreference", "uploadedImages"].includes(f)),
    `Expected painting-specific recommended: ${JSON.stringify(recommended)}`);
});
