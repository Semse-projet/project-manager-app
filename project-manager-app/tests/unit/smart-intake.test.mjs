import test from "node:test";
import assert from "node:assert/strict";
import { tsImport } from "tsx/esm/api";

const {
  buildInitialIntake,
  calculateAccuracyScore,
  derivePaintingScope,
  generateEstimate,
  generateMilestones,
  getNextQuestion,
  refreshDerivedState,
  updateAnswerSet,
} = await tsImport("../../apps/api/src/modules/smart-intake/smart-intake.logic.ts", import.meta.url);

function makeIntake() {
  return buildInitialIntake({
    id: "intk_test",
    tenantId: "tenant_default",
    sessionToken: "session_test",
    rawDescription: "Quiero pintar las paredes interiores del bano principal con preparacion y acabado limpio.",
    providedTitle: "Pintura interior bano",
    selectedCategoryId: "pintura",
    selectedSubcategoryId: "interior",
    modality: "on_site",
    city: "Miami, FL",
    urgency: "medium",
  });
}

function applyAnswers(intake, answers) {
  const mergedAnswers = answers.reduce(
    (current, answer) => updateAnswerSet(current, answer),
    intake.answers,
  );
  const derived = derivePaintingScope(mergedAnswers);
  return refreshDerivedState({
    ...intake,
    answers: mergedAnswers,
    estimatePreference: derived.estimatePreference,
    projectScope: derived.projectScope,
  });
}

function answer(questionId, selectedValues, options = {}) {
  return {
    questionId,
    selectedValues,
    customText: options.customText,
    isNotSure: options.isNotSure ?? false,
    answeredAt: "2026-05-10T00:00:00.000Z",
  };
}

test("calculateAccuracyScore gives full score for a complete painting intake", () => {
  let intake = makeIntake();
  intake = applyAnswers(intake, [
    answer("painting_area", ["other"], { customText: "240 sqft" }),
    answer("painting_condition", ["good"]),
    answer("painting_coats", ["2"]),
    answer("painting_estimate_preference", ["both"]),
    answer("painting_pricing_mode", ["per_area"]),
    answer("painting_duration", ["3_5_days"]),
  ]);
  intake = refreshDerivedState({
    ...intake,
    uploadedImages: [
      {
        id: "img_1",
        key: "evidence/smart-intake-1.jpg",
        url: "https://example.com/evidence/smart-intake-1.jpg",
        thumbnailUrl: "https://example.com/evidence/smart-intake-1-thumb.jpg",
        originalName: "wall.jpg",
        contentType: "image/jpeg",
        sizeBytes: 1024,
        uploadedAt: "2026-05-10T00:00:00.000Z",
        imageType: "before",
        evidenceStatus: "draft",
      },
    ],
  });

  assert.equal(calculateAccuracyScore(intake), 100);
  assert.equal(intake.accuracyLevel, "high");
});

test("calculateAccuracyScore grants partial credit for not-sure answers", () => {
  const intake = applyAnswers(makeIntake(), [
    answer("painting_area", [], { isNotSure: true }),
    answer("painting_condition", [], { isNotSure: true }),
    answer("painting_coats", [], { isNotSure: true }),
    answer("painting_estimate_preference", [], { isNotSure: true }),
    answer("painting_pricing_mode", [], { isNotSure: true }),
    answer("painting_duration", [], { isNotSure: true }),
  ]);

  assert.equal(calculateAccuracyScore(intake), 38);
  assert.equal(intake.status, "ready_for_estimate");
});

test("calculateAccuracyScore treats other without customText as unanswered", () => {
  const intake = applyAnswers(makeIntake(), [
    answer("painting_area", ["other"]),
    answer("painting_condition", ["good"]),
  ]);

  assert.equal(calculateAccuracyScore(intake), 35);
  assert.ok(intake.missingFields.includes("area"));
});

test("getNextQuestion advances in order and returns null when complete", () => {
  const emptyIntake = makeIntake();
  assert.equal(getNextQuestion(emptyIntake)?.id, "painting_area");

  const completedIntake = applyAnswers(emptyIntake, [
    answer("painting_area", ["100_250_sqft"]),
    answer("painting_condition", ["minor_repairs"]),
    answer("painting_coats", ["2"]),
    answer("painting_estimate_preference", ["both"]),
    answer("painting_pricing_mode", ["per_area"]),
    answer("painting_duration", ["3_5_days"]),
  ]);

  assert.equal(getNextQuestion(completedIntake), null);
});

test("generateEstimate uses fallback area when area is unknown", () => {
  const intake = applyAnswers(makeIntake(), [
    answer("painting_condition", ["minor_repairs"]),
    answer("painting_coats", ["2"]),
    answer("painting_estimate_preference", ["both"]),
    answer("painting_pricing_mode", ["per_area"]),
  ]);

  const estimate = generateEstimate(intake);

  assert.equal(estimate.totalRange.currency, "USD");
  assert.ok(estimate.totalRange.min > 0);
  assert.ok(estimate.assumptions.some((item) => item.includes("Area assumed 150-400 sqft")));
});

test("generateMilestones skips repair and primer when condition is good and still totals 100 percent", () => {
  const intake = applyAnswers(makeIntake(), [
    answer("painting_area", ["100_250_sqft"]),
    answer("painting_condition", ["good"]),
    answer("painting_coats", ["2"]),
    answer("painting_estimate_preference", ["both"]),
    answer("painting_pricing_mode", ["per_area"]),
  ]);

  const milestones = generateMilestones(intake);
  const titles = milestones.map((milestone) => milestone.title.en);
  const totalPayment = milestones.reduce((sum, milestone) => sum + (milestone.paymentPercentage ?? 0), 0);

  assert.equal(titles.includes("Surface repair"), false);
  assert.equal(titles.includes("Primer application"), false);
  assert.equal(totalPayment, 100);
});
