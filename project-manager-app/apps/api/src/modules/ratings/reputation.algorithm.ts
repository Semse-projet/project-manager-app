/**
 * Reputation scoring algorithm — pure functions, no I/O.
 *
 * Multi-signal formula (weights sum to 1.0):
 *   decayedRating         × 0.40  — exponential time-decay weighted avg of all ratings
 *   completionRate        × 0.30  — completed_jobs / total_jobs_as_professional
 *   disputeResilienceRate × 0.20  — 1 - (disputes_against / total_jobs)
 *   verificationSignal    × 0.10  — verified=1, pending=0.5, unverified=0
 *
 * Time decay: weight_i = exp(-λ × days_since_i), λ = ln(2)/180
 * This gives a half-life of 180 days — a 6-month-old rating counts ~50% as much
 * as a rating from today.
 *
 * Result: score 0-100, tier: emerging | growing | established | trusted
 *
 * Algorithm version: v1.0
 */

import type { ReputationScoreView, ReputationTier } from "@semse/schemas";

export const REPUTATION_ALGO_VERSION = "v1.0";

// Half-life = 180 days → λ = ln(2)/180 ≈ 0.00385
const DECAY_HALF_LIFE_DAYS = 180;
const LAMBDA = Math.LN2 / DECAY_HALF_LIFE_DAYS;

const WEIGHTS = {
  rating: 0.40,
  completion: 0.30,
  dispute: 0.20,
  verification: 0.10
} as const;

const VERIFICATION_SIGNAL: Record<string, number> = {
  verified: 1.0,
  pending: 0.5,
  unverified: 0.0,
  suspended: 0.0
};

export type RatingInput = {
  score: number;
  createdAt: Date;
};

export type ReputationInput = {
  userId: string;
  verificationStatus: string;
  ratings: RatingInput[];
  totalJobsAsProfessional: number;
  completedJobs: number;
  disputesAgainst: number;
};

/** Days between two dates. */
function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Exponential-decay weighted average of ratings.
 * More recent ratings receive higher weight.
 * Returns 0 if no ratings.
 */
export function computeDecayedRating(ratings: RatingInput[], now: Date): number {
  if (ratings.length === 0) return 0;

  let weightedSum = 0;
  let weightSum = 0;

  for (const r of ratings) {
    const days = daysBetween(r.createdAt, now);
    const weight = Math.exp(-LAMBDA * days);
    weightedSum += r.score * weight;
    weightSum += weight;
  }

  return weightSum === 0 ? 0 : weightedSum / weightSum;
}

function tierFromScore(score: number): ReputationTier {
  if (score >= 80) return "trusted";
  if (score >= 60) return "established";
  if (score >= 35) return "growing";
  return "emerging";
}

/** Compute the full reputation score for a user. */
export function computeReputation(input: ReputationInput): ReputationScoreView {
  const now = new Date();

  // Signal 1: time-decayed rating (normalised 0-1)
  const rawDecayedRating = computeDecayedRating(input.ratings, now);
  const decayedRating = Math.min(1, rawDecayedRating / 5);

  // Signal 2: completion rate
  const completionRate =
    input.totalJobsAsProfessional > 0
      ? Math.min(1, input.completedJobs / input.totalJobsAsProfessional)
      : 0;

  // Signal 3: dispute resilience (1 - dispute_rate)
  const disputeResilienceRate =
    input.totalJobsAsProfessional > 0
      ? Math.max(0, 1 - input.disputesAgainst / input.totalJobsAsProfessional)
      : 1;

  // Signal 4: verification
  const verificationSignal = VERIFICATION_SIGNAL[input.verificationStatus] ?? 0;

  const rawScore =
    WEIGHTS.rating * decayedRating +
    WEIGHTS.completion * completionRate +
    WEIGHTS.dispute * disputeResilienceRate +
    WEIGHTS.verification * verificationSignal;

  const score = Math.round(Math.min(100, Math.max(0, rawScore * 100)) * 10) / 10;

  return {
    userId: input.userId,
    score,
    tier: tierFromScore(score),
    signals: {
      decayedRating: Math.round(decayedRating * 1000) / 1000,
      completionRate: Math.round(completionRate * 1000) / 1000,
      disputeResilienceRate: Math.round(disputeResilienceRate * 1000) / 1000,
      verificationSignal,
      totalRatings: input.ratings.length,
      totalJobsAsProf: input.totalJobsAsProfessional,
      completedJobs: input.completedJobs,
      disputesAgainst: input.disputesAgainst
    },
    decayHalfLifeDays: DECAY_HALF_LIFE_DAYS,
    algorithmVersion: REPUTATION_ALGO_VERSION,
    computedAt: now.toISOString()
  };
}
