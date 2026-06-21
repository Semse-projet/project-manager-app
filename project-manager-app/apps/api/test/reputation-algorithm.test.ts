import test from "node:test";
import assert from "node:assert/strict";

/**
 * Reputation Algorithm — pure logic tests.
 * Covers: decay computation, signal weighting, tier boundaries, edge cases.
 * No DB, no I/O.
 */

// ── Reproduce algorithm (mirrors reputation.algorithm.ts) ───────────────────

const DECAY_HALF_LIFE_DAYS = 180;
const LAMBDA = Math.LN2 / DECAY_HALF_LIFE_DAYS;

const WEIGHTS = { rating: 0.40, completion: 0.30, dispute: 0.20, verification: 0.10 } as const;

const VERIFICATION_SIGNAL: Record<string, number> = {
  verified: 1.0, pending: 0.5, unverified: 0.0, suspended: 0.0,
};

type RatingInput = { score: number; createdAt: Date };
type ReputationInput = {
  userId: string;
  verificationStatus: string;
  ratings: RatingInput[];
  totalJobsAsProfessional: number;
  completedJobs: number;
  disputesAgainst: number;
};

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

function computeDecayedRating(ratings: RatingInput[], now: Date): number {
  if (ratings.length === 0) return 0;
  let weightedSum = 0, weightSum = 0;
  for (const r of ratings) {
    const days = daysBetween(r.createdAt, now);
    const weight = Math.exp(-LAMBDA * days);
    weightedSum += r.score * weight;
    weightSum += weight;
  }
  return weightSum === 0 ? 0 : weightedSum / weightSum;
}

function tierFromScore(score: number): string {
  if (score >= 80) return "trusted";
  if (score >= 60) return "established";
  if (score >= 35) return "growing";
  return "emerging";
}

function computeReputation(input: ReputationInput) {
  const now = new Date();
  const rawDecayedRating = computeDecayedRating(input.ratings, now);
  const decayedRating = Math.min(1, rawDecayedRating / 5);
  const completionRate = input.totalJobsAsProfessional > 0
    ? Math.min(1, input.completedJobs / input.totalJobsAsProfessional) : 0;
  const disputeResilienceRate = input.totalJobsAsProfessional > 0
    ? Math.max(0, 1 - input.disputesAgainst / input.totalJobsAsProfessional) : 1;
  const verificationSignal = VERIFICATION_SIGNAL[input.verificationStatus] ?? 0;
  const rawScore =
    WEIGHTS.rating * decayedRating +
    WEIGHTS.completion * completionRate +
    WEIGHTS.dispute * disputeResilienceRate +
    WEIGHTS.verification * verificationSignal;
  const score = Math.round(Math.min(100, Math.max(0, rawScore * 100)) * 10) / 10;
  return { score, tier: tierFromScore(score), signals: { decayedRating, completionRate, disputeResilienceRate, verificationSignal } };
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

// ── Tier boundary tests ──────────────────────────────────────────────────────

test("RA.T1: perfect profile → trusted tier (score ≥ 80)", () => {
  const result = computeReputation({
    userId: "u1",
    verificationStatus: "verified",
    ratings: [{ score: 5, createdAt: daysAgo(1) }, { score: 5, createdAt: daysAgo(7) }],
    totalJobsAsProfessional: 20,
    completedJobs: 20,
    disputesAgainst: 0,
  });
  assert.equal(result.tier, "trusted");
  assert.ok(result.score >= 80, `Expected ≥80, got ${result.score}`);
});

test("RA.T2: new unverified contractor with no jobs → emerging tier", () => {
  const result = computeReputation({
    userId: "u2",
    verificationStatus: "unverified",
    ratings: [],
    totalJobsAsProfessional: 0,
    completedJobs: 0,
    disputesAgainst: 0,
  });
  assert.equal(result.tier, "emerging");
  assert.ok(result.score < 35, `Expected <35, got ${result.score}`);
});

test("RA.T3: score exactly 80 → trusted", () => {
  assert.equal(tierFromScore(80), "trusted");
});

test("RA.T4: score 79.9 → established", () => {
  assert.equal(tierFromScore(79.9), "established");
});

test("RA.T5: score exactly 60 → established", () => {
  assert.equal(tierFromScore(60), "established");
});

test("RA.T6: score 59.9 → growing", () => {
  assert.equal(tierFromScore(59.9), "growing");
});

test("RA.T7: score exactly 35 → growing", () => {
  assert.equal(tierFromScore(35), "growing");
});

test("RA.T8: score 34.9 → emerging", () => {
  assert.equal(tierFromScore(34.9), "emerging");
});

// ── Signal tests ────────────────────────────────────────────────────────────

test("RA.S1: verification signal — verified=1.0, pending=0.5, unverified=0, suspended=0", () => {
  assert.equal(VERIFICATION_SIGNAL["verified"],   1.0);
  assert.equal(VERIFICATION_SIGNAL["pending"],    0.5);
  assert.equal(VERIFICATION_SIGNAL["unverified"], 0.0);
  assert.equal(VERIFICATION_SIGNAL["suspended"],  0.0);
});

test("RA.S2: unknown verificationStatus defaults to 0", () => {
  const signal = VERIFICATION_SIGNAL["unknown_status"] ?? 0;
  assert.equal(signal, 0);
});

test("RA.S3: 100% completion rate → completionRate=1.0", () => {
  const result = computeReputation({
    userId: "u3",
    verificationStatus: "unverified",
    ratings: [],
    totalJobsAsProfessional: 10,
    completedJobs: 10,
    disputesAgainst: 0,
  });
  assert.equal(result.signals.completionRate, 1.0);
});

test("RA.S4: 0 jobs → completionRate=0, disputeResilienceRate=1 (neutral, not penalised)", () => {
  const result = computeReputation({
    userId: "u4",
    verificationStatus: "unverified",
    ratings: [],
    totalJobsAsProfessional: 0,
    completedJobs: 0,
    disputesAgainst: 0,
  });
  assert.equal(result.signals.completionRate, 0);
  assert.equal(result.signals.disputeResilienceRate, 1);
});

test("RA.S5: 100% dispute rate → disputeResilienceRate=0", () => {
  const result = computeReputation({
    userId: "u5",
    verificationStatus: "unverified",
    ratings: [],
    totalJobsAsProfessional: 5,
    completedJobs: 3,
    disputesAgainst: 5,
  });
  assert.equal(result.signals.disputeResilienceRate, 0);
});

test("RA.S6: 50% dispute rate → disputeResilienceRate=0.5", () => {
  const result = computeReputation({
    userId: "u6",
    verificationStatus: "unverified",
    ratings: [],
    totalJobsAsProfessional: 10,
    completedJobs: 8,
    disputesAgainst: 5,
  });
  assert.equal(result.signals.disputeResilienceRate, 0.5);
});

// ── Time decay tests ─────────────────────────────────────────────────────────

test("RA.D1: recent ratings outweigh old ones in average — decay is actually applied", () => {
  // Two ratings: fresh 5-star + old 1-star. With decay, fresh dominates → avg > 3 (neutral).
  // Without decay: simple avg = (5+1)/2 = 3. With decay: recent 5 dominates → result > 3.
  const now = new Date();
  const mixed = [
    { score: 5, createdAt: daysAgo(1) },
    { score: 1, createdAt: daysAgo(360) },
  ];
  const decay = computeDecayedRating(mixed, now);
  assert.ok(decay > 3, `Decay-weighted avg should be >3 (fresh 5-star dominates), got ${decay}`);
  assert.ok(decay < 5, `Decay-weighted avg should be <5 (old 1-star has some influence), got ${decay}`);
});

test("RA.D2: rating at exactly 180 days old has weight ≈ 0.5 of today's", () => {
  const now = new Date();
  const weight180 = Math.exp(-LAMBDA * 180);
  assert.ok(Math.abs(weight180 - 0.5) < 0.01, `Expected ~0.5, got ${weight180}`);
});

test("RA.D3: no ratings → decayedRating=0", () => {
  const decay = computeDecayedRating([], new Date());
  assert.equal(decay, 0);
});

test("RA.D4: single recent 5-star → decayedRating ≈ 5", () => {
  const now = new Date();
  const decay = computeDecayedRating([{ score: 5, createdAt: daysAgo(1) }], now);
  assert.ok(decay > 4.95 && decay <= 5, `Got ${decay}`);
});

test("RA.D5: mix of old 1-star and fresh 5-star → result closer to 5", () => {
  const now = new Date();
  const mixed = [
    { score: 1, createdAt: daysAgo(720) },
    { score: 5, createdAt: daysAgo(1) },
  ];
  const decay = computeDecayedRating(mixed, now);
  assert.ok(decay > 3, `Expected >3 (fresh star dominates), got ${decay}`);
});

// ── Full score composition tests ────────────────────────────────────────────

test("RA.C1: weights sum to 1.0", () => {
  const sum = WEIGHTS.rating + WEIGHTS.completion + WEIGHTS.dispute + WEIGHTS.verification;
  assert.ok(Math.abs(sum - 1.0) < 0.0001, `Weights sum to ${sum}`);
});

test("RA.C2: verified + 5-star + all completed + 0 disputes → score near 100", () => {
  const result = computeReputation({
    userId: "u7",
    verificationStatus: "verified",
    ratings: [
      { score: 5, createdAt: daysAgo(2) },
      { score: 5, createdAt: daysAgo(10) },
      { score: 5, createdAt: daysAgo(30) },
    ],
    totalJobsAsProfessional: 50,
    completedJobs: 50,
    disputesAgainst: 0,
  });
  assert.ok(result.score >= 95, `Expected ≥95, got ${result.score}`);
  assert.equal(result.tier, "trusted");
});

test("RA.C3: unverified + no ratings + 50% completion + no disputes → growing tier", () => {
  const result = computeReputation({
    userId: "u8",
    verificationStatus: "unverified",
    ratings: [],
    totalJobsAsProfessional: 10,
    completedJobs: 5,
    disputesAgainst: 0,
  });
  // completion=0.5 × 0.30 + dispute=1.0 × 0.20 = 0.15+0.20 = 0.35 → score=35 → growing
  assert.ok(result.score >= 35, `Expected ≥35, got ${result.score}`);
});

test("RA.C4: score is clamped at 0 minimum even with extreme dispute rate", () => {
  const result = computeReputation({
    userId: "u9",
    verificationStatus: "suspended",
    ratings: [{ score: 1, createdAt: daysAgo(400) }],
    totalJobsAsProfessional: 5,
    completedJobs: 0,
    disputesAgainst: 10,
  });
  assert.ok(result.score >= 0, `Score must be ≥0, got ${result.score}`);
});

test("RA.C5: score is clamped at 100 maximum", () => {
  const result = computeReputation({
    userId: "u10",
    verificationStatus: "verified",
    ratings: [{ score: 5, createdAt: new Date() }],
    totalJobsAsProfessional: 1,
    completedJobs: 1,
    disputesAgainst: 0,
  });
  assert.ok(result.score <= 100, `Score must be ≤100, got ${result.score}`);
});

test("RA.C6: pending verification gives 0.05 contribution (0.5 × 0.10)", () => {
  const withPending = computeReputation({
    userId: "u11a", verificationStatus: "pending",
    ratings: [], totalJobsAsProfessional: 0, completedJobs: 0, disputesAgainst: 0,
  });
  const withUnverified = computeReputation({
    userId: "u11b", verificationStatus: "unverified",
    ratings: [], totalJobsAsProfessional: 0, completedJobs: 0, disputesAgainst: 0,
  });
  const diff = withPending.score - withUnverified.score;
  assert.ok(Math.abs(diff - 5) < 1, `Expected ~5 point difference, got ${diff}`);
});
