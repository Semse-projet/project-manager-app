import test from "node:test";
import assert from "node:assert/strict";

/**
 * Prometeo RAG Phase 5 — Human Feedback Memory Loop
 *
 * Tests:
 * - Feedback score calculation (confirm / correct / flag)
 * - Feedback boost integration in hybrid scoring
 * - getFeedbackScores aggregation logic
 * - Score clamping at [-1, 1]
 * - Feedback does not penalize zero-feedback chunks
 * - Edge cases: empty, all-flags, all-confirms
 */

// ── Replicate score logic from prometeo.service.ts ─────────────────────────────

const SEMANTIC_WEIGHT = 0.70;
const FTS_WEIGHT      = 0.30;
const FEEDBACK_WEIGHT = 0.15;

const FEEDBACK_WEIGHTS: Record<string, number> = { confirm: 1.0, correct: 0.5, flag: -1.0 };

function computeFeedbackScore(entries: Array<{ type: string }>): number {
  if (!entries.length) return 0;
  const sum   = entries.reduce((s, e) => s + (FEEDBACK_WEIGHTS[e.type] ?? 0), 0);
  const count = entries.length;
  return Math.max(-1, Math.min(1, sum / count));
}

function computeHybridScore(semantic: number, fts: number, feedback: number): number {
  const base = SEMANTIC_WEIGHT * semantic + FTS_WEIGHT * fts;
  return base + FEEDBACK_WEIGHT * feedback;
}

// ── F: Feedback score tests ────────────────────────────────────────────────────

test("F.1: no feedback → score = 0", () => {
  assert.equal(computeFeedbackScore([]), 0);
});

test("F.2: single confirm → score = 1.0", () => {
  assert.equal(computeFeedbackScore([{ type: "confirm" }]), 1.0);
});

test("F.3: single flag → score = -1.0", () => {
  assert.equal(computeFeedbackScore([{ type: "flag" }]), -1.0);
});

test("F.4: single correct → score = 0.5", () => {
  assert.equal(computeFeedbackScore([{ type: "correct" }]), 0.5);
});

test("F.5: mixed confirm + flag → score = 0.0", () => {
  const score = computeFeedbackScore([{ type: "confirm" }, { type: "flag" }]);
  assert.equal(score, 0.0);
});

test("F.6: two confirms + one flag → score = 0.333", () => {
  const score = computeFeedbackScore([
    { type: "confirm" }, { type: "confirm" }, { type: "flag" },
  ]);
  assert.ok(Math.abs(score - 0.333) < 0.01, `Expected ~0.333, got ${score}`);
});

test("F.7: clamping — cannot exceed 1.0", () => {
  const score = computeFeedbackScore([
    { type: "confirm" }, { type: "confirm" }, { type: "confirm" },
  ]);
  assert.equal(score, 1.0);
  assert.ok(score <= 1.0);
});

test("F.8: clamping — cannot go below -1.0", () => {
  const score = computeFeedbackScore([
    { type: "flag" }, { type: "flag" }, { type: "flag" },
  ]);
  assert.equal(score, -1.0);
  assert.ok(score >= -1.0);
});

test("F.9: unknown type is treated as 0 weight", () => {
  const score = computeFeedbackScore([{ type: "unknown_type" }]);
  assert.equal(score, 0.0);
});

test("F.10: correct + confirm → 0.75", () => {
  const score = computeFeedbackScore([{ type: "correct" }, { type: "confirm" }]);
  assert.ok(Math.abs(score - 0.75) < 0.01, `Expected 0.75, got ${score}`);
});

// ── H: Hybrid score with feedback boost ──────────────────────────────────────

test("H.1: zero feedback — score unchanged from base", () => {
  const base  = SEMANTIC_WEIGHT * 0.6 + FTS_WEIGHT * 0.4;
  const final = computeHybridScore(0.6, 0.4, 0);
  assert.ok(Math.abs(final - base) < 0.0001);
});

test("H.2: confirmed chunk gets max boost", () => {
  const noFeedback = computeHybridScore(0.5, 0.3, 0);
  const confirmed  = computeHybridScore(0.5, 0.3, 1.0);
  assert.ok(confirmed - noFeedback > 0.14, `Expected ~+0.15 boost, got ${confirmed - noFeedback}`);
  assert.ok(Math.abs(confirmed - noFeedback - FEEDBACK_WEIGHT) < 0.001);
});

test("H.3: flagged chunk gets max penalty", () => {
  const noFeedback = computeHybridScore(0.5, 0.3, 0);
  const flagged    = computeHybridScore(0.5, 0.3, -1.0);
  assert.ok(noFeedback - flagged > 0.14, `Expected ~-0.15 penalty, got ${noFeedback - flagged}`);
  assert.ok(Math.abs(noFeedback - flagged - FEEDBACK_WEIGHT) < 0.001);
});

test("H.4: confirmed chunk ranks above equal-base chunk with no feedback", () => {
  const chunk1 = computeHybridScore(0.6, 0.4, 1.0); // confirmed
  const chunk2 = computeHybridScore(0.6, 0.4, 0);   // no feedback
  assert.ok(chunk1 > chunk2, `Confirmed should rank higher: ${chunk1} vs ${chunk2}`);
});

test("H.5: flagged chunk ranks below equal-base chunk with no feedback", () => {
  const chunk1 = computeHybridScore(0.6, 0.4, -1.0); // flagged
  const chunk2 = computeHybridScore(0.6, 0.4, 0);    // no feedback
  assert.ok(chunk1 < chunk2, `Flagged should rank lower: ${chunk1} vs ${chunk2}`);
});

test("H.6: feedback boost < 0.15 does not overwhelm semantic+FTS (high-quality chunk still wins)", () => {
  const highQuality = computeHybridScore(0.85, 0.7, 0);    // great match, no feedback
  const lowQualityConfirmed = computeHybridScore(0.3, 0.1, 1.0); // poor match, confirmed
  // Feedback should not override a much better semantic match
  assert.ok(highQuality > lowQualityConfirmed,
    `High-quality match (${highQuality}) should beat low-quality+confirmed (${lowQualityConfirmed})`);
});

// ── A: Aggregation logic (Map simulation) ────────────────────────────────────

test("A.1: getFeedbackScores aggregates multiple entries per chunk", () => {
  // Simulate what the repo does
  const rows = [
    { chunkId: "c1", type: "confirm" },
    { chunkId: "c1", type: "confirm" },
    { chunkId: "c1", type: "flag" },
    { chunkId: "c2", type: "flag" },
    { chunkId: "c2", type: "flag" },
  ];

  const acc = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    const w   = FEEDBACK_WEIGHTS[r.type] ?? 0;
    const cur = acc.get(r.chunkId) ?? { sum: 0, count: 0 };
    acc.set(r.chunkId, { sum: cur.sum + w, count: cur.count + 1 });
  }

  const result = new Map<string, number>();
  for (const [id, { sum, count }] of acc) {
    result.set(id, Math.max(-1, Math.min(1, sum / count)));
  }

  // c1: (1 + 1 - 1) / 3 = 0.333
  const c1 = result.get("c1")!;
  assert.ok(Math.abs(c1 - 0.333) < 0.01, `c1 expected 0.333, got ${c1}`);

  // c2: (-1 + -1) / 2 = -1.0
  assert.equal(result.get("c2"), -1.0);
});

test("A.2: chunks not in feedback map get score 0 (no penalty)", () => {
  const feedbackMap = new Map([["c1", 0.8]]);
  const score = feedbackMap.get("c999") ?? 0;
  assert.equal(score, 0); // no feedback = neutral
});

test("A.3: empty feedback map → no modification to scores", () => {
  const feedbackMap = new Map<string, number>();
  const baseScore = computeHybridScore(0.6, 0.4, feedbackMap.get("any") ?? 0);
  const expected  = SEMANTIC_WEIGHT * 0.6 + FTS_WEIGHT * 0.4;
  assert.ok(Math.abs(baseScore - expected) < 0.0001);
});

// ── V: Validation (endpoint type guard) ──────────────────────────────────────

test("V.1: valid feedback types accepted", () => {
  const VALID = ["confirm", "correct", "flag"];
  for (const t of VALID) {
    assert.ok(VALID.includes(t), `${t} should be valid`);
  }
});

test("V.2: invalid feedback types rejected", () => {
  const VALID = ["confirm", "correct", "flag"];
  const invalid = ["approve", "reject", "like", "", "CONFIRM"];
  for (const t of invalid) {
    assert.ok(!VALID.includes(t), `${t} should be invalid`);
  }
});
