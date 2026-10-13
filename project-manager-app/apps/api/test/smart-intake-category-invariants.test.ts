import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_REGISTRY } from "../dist/modules/smart-intake/config/category-registry.js";
import { SCORING_PROFILES } from "../dist/modules/smart-intake/config/scoring-profiles.js";
import { SIZE_SCALES, resolveSizeScale } from "../dist/modules/smart-intake/config/size-scales.js";
import {
  buildInitialIntake,
  generateEstimate,
  getAccuracyDetail,
} from "../dist/modules/smart-intake/smart-intake.logic.js";

// Invariants driven by the registry itself, so any future category is covered
// automatically and typos between questions, scoring and risk triggers fail fast.

const CATEGORY_IDS = Object.keys(CATEGORY_REGISTRY);

function makeIntake(category: string, answers: Array<{ questionId: string; values: string[] }> = []) {
  const base = buildInitialIntake({
    id: `intk_${category}`,
    tenantId: "t_test",
    sessionToken: `sess_${category}`,
    rawDescription: "Need help with a project at my home",
  });
  return {
    ...base,
    detectedCategory: category,
    answers: answers.map((a) => ({
      questionId: a.questionId,
      selectedValues: a.values,
      isNotSure: false,
      answeredAt: new Date().toISOString(),
    })),
  } as typeof base;
}

// ── question structure ─────────────────────────────────────────────────────

test("every question belongs to its category and has unique ids and steps", () => {
  for (const [id, def] of Object.entries(CATEGORY_REGISTRY)) {
    const ids = new Set<string>();
    const steps = new Set<number>();
    for (const q of def.questions) {
      assert.equal(q.category, id, `${id}: question ${q.id} has category ${q.category}`);
      assert.ok(!ids.has(q.id), `${id}: duplicate question id ${q.id}`);
      assert.ok(!steps.has(q.step), `${id}: duplicate step ${q.step}`);
      ids.add(q.id);
      steps.add(q.step);
    }
  }
});

test("every option has a unique value and non-empty ES/EN labels", () => {
  for (const [id, def] of Object.entries(CATEGORY_REGISTRY)) {
    for (const q of def.questions) {
      assert.ok(q.label.es.trim() && q.label.en.trim(), `${id}/${q.id}: empty question label`);
      const seen = new Set<string>();
      for (const opt of q.options ?? []) {
        assert.ok(opt.label.es.trim() && opt.label.en.trim(), `${id}/${q.id}/${opt.value}: empty option label`);
        assert.ok(!seen.has(opt.value), `${id}/${q.id}: duplicate option value ${opt.value}`);
        seen.add(opt.value);
      }
    }
  }
});

// ── scoring profiles reference real questions and options ──────────────────

test("scoring weights reference existing questions of the same category", () => {
  for (const [id, profile] of Object.entries(SCORING_PROFILES)) {
    if (id === "generic" || !profile) continue;
    const questionIds = new Set(CATEGORY_REGISTRY[id as keyof typeof CATEGORY_REGISTRY].questions.map((q) => q.id));
    for (const w of profile.weights) {
      assert.ok(questionIds.has(w.questionId), `${id}: weight references unknown question ${w.questionId}`);
    }
  }
});

test("risk triggers reference existing questions and real option values", () => {
  for (const [id, profile] of Object.entries(SCORING_PROFILES)) {
    if (id === "generic" || !profile) continue;
    const questions = CATEGORY_REGISTRY[id as keyof typeof CATEGORY_REGISTRY].questions;
    for (const t of profile.riskTriggers ?? []) {
      const q = questions.find((x) => x.id === t.questionId);
      assert.ok(q, `${id}: trigger references unknown question ${t.questionId}`);
      assert.ok(
        (q!.options ?? []).some((o) => o.value === t.value),
        `${id}: trigger value "${t.value}" is not an option of ${t.questionId}`,
      );
    }
  }
});

test("every risk trigger surfaces its flag through getAccuracyDetail", () => {
  for (const [id, profile] of Object.entries(SCORING_PROFILES)) {
    if (id === "generic" || !profile) continue;
    for (const t of profile.riskTriggers ?? []) {
      const detail = getAccuracyDetail(makeIntake(id, [{ questionId: t.questionId, values: [t.value] }]));
      assert.ok(detail.riskFlags.includes(t.flag), `${id}: ${t.questionId}=${t.value} did not raise ${t.flag}`);
    }
  }
});

// ── milestones ─────────────────────────────────────────────────────────────

test("milestone payment percentages sum to 100 with consecutive order", () => {
  for (const [id, def] of Object.entries(CATEGORY_REGISTRY)) {
    const total = def.milestones.reduce((sum, m) => sum + m.paymentPercentage, 0);
    assert.equal(total, 100, `${id}: milestones sum to ${total}`);
    def.milestones.forEach((m, i) => assert.equal(m.order, i + 1, `${id}: milestone order gap at ${i}`));
  }
});

// ── estimates ──────────────────────────────────────────────────────────────

test("every category yields a sane estimate range with no answers", () => {
  for (const id of CATEGORY_IDS) {
    const est = generateEstimate(makeIntake(id));
    assert.ok(Number.isFinite(est.totalRange.min) && Number.isFinite(est.totalRange.max), `${id}: non-finite range`);
    assert.ok(est.totalRange.min > 0, `${id}: min <= 0`);
    assert.ok(est.totalRange.min <= est.totalRange.max, `${id}: min > max`);
  }
});

const SCOPE_QUESTION: Record<string, string> = {
  roofing: "roofing_scope",
  hvac: "hvac_scope",
  fencing_decks: "fencing_scope",
  handyman: "handyman_scope",
  masonry_concrete: "masonry_scope",
  demolition: "demolition_scope",
  moving: "moving_scope",
  pressure_washing: "pw_scope",
};

test("estimate grows with job size for the new fixed-rate categories", () => {
  for (const [id, scopeQ] of Object.entries(SCOPE_QUESTION)) {
    const at = (v: string) => generateEstimate(makeIntake(id, [{ questionId: scopeQ, values: [v] }])).totalRange;
    const small = at("small");
    const medium = at("medium");
    const large = at("large");
    assert.ok(small.max <= medium.max, `${id}: small.max ${small.max} > medium.max ${medium.max}`);
    assert.ok(medium.max < large.max, `${id}: medium.max ${medium.max} >= large.max ${large.max}`);
    assert.ok(small.min <= medium.min && medium.min <= large.min, `${id}: min not monotonic`);
  }
});

test("answering all critical questions makes new categories estimate-ready", () => {
  for (const id of Object.keys(SCOPE_QUESTION)) {
    const profile = SCORING_PROFILES[id as keyof typeof SCORING_PROFILES]!;
    const questions = CATEGORY_REGISTRY[id as keyof typeof CATEGORY_REGISTRY].questions;
    const answers = profile.weights.map((w) => {
      const q = questions.find((x) => x.id === w.questionId)!;
      return { questionId: w.questionId, values: [q.options![0].value] };
    });
    const intake = { ...makeIntake(id, answers), uploadedImages: [{} as never] };
    const detail = getAccuracyDetail(intake);
    assert.deepEqual(detail.missingCriticalFields, [], `${id}: critical fields still missing`);
    assert.equal(detail.estimateReady, true, `${id}: not estimate-ready with every question answered (score ${detail.score})`);
  }
});

// ── size scales ──────────────────────────────────────────────────────────────

test("every size scale points at a real question of its category with small/large options", () => {
  for (const [category, scale] of Object.entries(SIZE_SCALES)) {
    const question = CATEGORY_REGISTRY[category as keyof typeof CATEGORY_REGISTRY].questions.find((q) => q.id === scale!.questionId);
    assert.ok(question, `${category}: unknown question ${scale!.questionId}`);
    const values = (question!.options ?? []).map((o) => o.value);
    assert.ok(values.includes("small") && values.includes("large"), `${category}: ${scale!.questionId} lacks small/large`);
    if (scale!.extraLarge !== undefined) assert.ok(values.includes("extra_large"), `${category}: missing extra_large option`);
  }
});

test("resolveSizeScale applies the configured multipliers and defaults to 1", () => {
  assert.equal(resolveSizeScale("bathroom_remodel", "small"), 0.65);
  assert.equal(resolveSizeScale("bathroom_remodel", "extra_large"), 1.9);
  assert.equal(resolveSizeScale("roofing", "large"), 2.2);
  assert.equal(resolveSizeScale("roofing", "extra_large"), 1);
  assert.equal(resolveSizeScale("roofing", null), 1);
  assert.equal(resolveSizeScale("interior_painting", "large"), 1);
});
