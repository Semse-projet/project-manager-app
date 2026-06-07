/**
 * Unit tests for reputation scoring algorithm.
 * Pure functions — no DB, no I/O.
 * Run: node --experimental-strip-types --test tests/unit/reputation-algorithm.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Inline pure functions (mirrors apps/api/src/modules/ratings/reputation.algorithm.ts) ──

const DECAY_HALF_LIFE_DAYS = 180;
const LAMBDA = Math.LN2 / DECAY_HALF_LIFE_DAYS;

const WEIGHTS = { rating: 0.40, completion: 0.30, dispute: 0.20, verification: 0.10 };
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

type ReputationTier = "emerging" | "growing" | "established" | "trusted";
function tierFromScore(score: number): ReputationTier {
  if (score >= 80) return "trusted";
  if (score >= 60) return "established";
  if (score >= 35) return "growing";
  return "emerging";
}

function computeReputation(input: ReputationInput): { score: number; tier: ReputationTier } {
  const now = new Date();
  const rawDecayedRating = computeDecayedRating(input.ratings, now);
  const decayedRating = Math.min(1, rawDecayedRating / 5);
  const completionRate = input.totalJobsAsProfessional > 0
    ? Math.min(1, input.completedJobs / input.totalJobsAsProfessional) : 0;
  const disputeResilienceRate = input.totalJobsAsProfessional > 0
    ? Math.max(0, 1 - input.disputesAgainst / input.totalJobsAsProfessional) : 1;
  const verificationSignal = VERIFICATION_SIGNAL[input.verificationStatus] ?? 0;
  const raw = (
    decayedRating * WEIGHTS.rating +
    completionRate * WEIGHTS.completion +
    disputeResilienceRate * WEIGHTS.dispute +
    verificationSignal * WEIGHTS.verification
  );
  const score = Math.round(Math.min(100, Math.max(0, raw * 100)));
  return { score, tier: tierFromScore(score) };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

const now = new Date();
const recent = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000);

test("no ratings, no jobs, unverified → tier emerging (dispute resilience defaults to 1)", () => {
  // With 0 jobs, dispute_resilience = 1 by convention → contributes 0.20 × 100 = 20 pts
  const r = computeReputation({ userId: "u1", verificationStatus: "unverified", ratings: [], totalJobsAsProfessional: 0, completedJobs: 0, disputesAgainst: 0 });
  assert.equal(r.score, 20);
  assert.equal(r.tier, "emerging");
});

test("perfect 5-star recent rating + verified + 10 jobs no disputes → trusted tier", () => {
  const ratings = Array.from({ length: 5 }, () => ({ score: 5, createdAt: recent(10) }));
  const r = computeReputation({ userId: "u1", verificationStatus: "verified", ratings, totalJobsAsProfessional: 10, completedJobs: 10, disputesAgainst: 0 });
  assert.ok(r.score >= 80, `Expected ≥80 but got ${r.score}`);
  assert.equal(r.tier, "trusted");
});

test("5-star but unverified → lower than verified counterpart", () => {
  const ratings = Array.from({ length: 5 }, () => ({ score: 5, createdAt: recent(10) }));
  const base = { userId: "u1", ratings, totalJobsAsProfessional: 10, completedJobs: 10, disputesAgainst: 0 };
  const verified = computeReputation({ ...base, verificationStatus: "verified" });
  const unverified = computeReputation({ ...base, verificationStatus: "unverified" });
  assert.ok(verified.score > unverified.score, `verified(${verified.score}) should > unverified(${unverified.score})`);
});

test("time decay: mixing old low + recent high skews toward recent", () => {
  // If recent ratings dominate, average should be closer to the recent score
  const mixed = computeDecayedRating([
    { score: 1, createdAt: recent(365) },  // old low
    { score: 5, createdAt: recent(1) },    // recent high
  ], now);
  // The result should be closer to 5 (recent) than to 3 (simple mean)
  assert.ok(mixed > 3.5, `Mixed decay should favor recent rating, got ${mixed.toFixed(2)}`);
});

test("half-life: 180-day decay weight is ~0.5 of fresh weight", () => {
  // The weight factor for a 180-day-old item: exp(-λ * 180) ≈ 0.5
  const weightFresh    = Math.exp(-LAMBDA * 0);
  const weightHalfLife = Math.exp(-LAMBDA * 180);
  const ratio = weightHalfLife / weightFresh;
  assert.ok(ratio > 0.45 && ratio < 0.55, `Half-life weight ratio should be ~0.5, got ${ratio.toFixed(3)}`);
});

test("dispute penalty: 50% dispute rate lowers score", () => {
  const ratings = [{ score: 4, createdAt: recent(5) }];
  const clean = computeReputation({ userId: "u1", verificationStatus: "verified", ratings, totalJobsAsProfessional: 10, completedJobs: 10, disputesAgainst: 0 });
  const disputed = computeReputation({ userId: "u1", verificationStatus: "verified", ratings, totalJobsAsProfessional: 10, completedJobs: 10, disputesAgainst: 5 });
  assert.ok(clean.score > disputed.score, `clean(${clean.score}) should > disputed(${disputed.score})`);
});

test("completion rate: 50% completion lowers score", () => {
  const ratings = [{ score: 4, createdAt: recent(5) }];
  const full = computeReputation({ userId: "u1", verificationStatus: "verified", ratings, totalJobsAsProfessional: 10, completedJobs: 10, disputesAgainst: 0 });
  const partial = computeReputation({ userId: "u1", verificationStatus: "verified", ratings, totalJobsAsProfessional: 10, completedJobs: 5, disputesAgainst: 0 });
  assert.ok(full.score > partial.score, `full(${full.score}) should > partial(${partial.score})`);
});

test("tier boundaries: 0→emerging, 35→growing, 60→established, 80→trusted", () => {
  assert.equal(tierFromScore(0), "emerging");
  assert.equal(tierFromScore(34), "emerging");
  assert.equal(tierFromScore(35), "growing");
  assert.equal(tierFromScore(59), "growing");
  assert.equal(tierFromScore(60), "established");
  assert.equal(tierFromScore(79), "established");
  assert.equal(tierFromScore(80), "trusted");
  assert.equal(tierFromScore(100), "trusted");
});

test("pending verification: score between unverified and verified", () => {
  const ratings = [{ score: 4, createdAt: recent(5) }];
  const base = { userId: "u1", ratings, totalJobsAsProfessional: 5, completedJobs: 5, disputesAgainst: 0 };
  const pending = computeReputation({ ...base, verificationStatus: "pending" });
  const verified = computeReputation({ ...base, verificationStatus: "verified" });
  const unverified = computeReputation({ ...base, verificationStatus: "unverified" });
  assert.ok(pending.score > unverified.score && pending.score < verified.score,
    `pending(${pending.score}) should be between unverified(${unverified.score}) and verified(${verified.score})`);
});

test("score is always 0-100", () => {
  const extremes = [
    { userId: "u", verificationStatus: "verified",   ratings: Array.from({ length: 100 }, () => ({ score: 5, createdAt: recent(1) })),   totalJobsAsProfessional: 100, completedJobs: 100, disputesAgainst: 0 },
    { userId: "u", verificationStatus: "suspended",  ratings: Array.from({ length: 100 }, () => ({ score: 1, createdAt: recent(500) })), totalJobsAsProfessional: 100, completedJobs: 10,  disputesAgainst: 90 },
  ];
  for (const input of extremes) {
    const r = computeReputation(input);
    assert.ok(r.score >= 0 && r.score <= 100, `Score ${r.score} out of bounds`);
  }
});
