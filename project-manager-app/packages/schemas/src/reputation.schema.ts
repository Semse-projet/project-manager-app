import { z } from "zod";

// ── Output ─────────────────────────────────────────────────────────────────────

export const reputationSignalsSchema = z.object({
  /** Exponential-decay weighted average of all ratings. 0-1. */
  decayedRating: z.number(),
  /** completed_jobs / total_jobs_as_professional. 0-1. */
  completionRate: z.number(),
  /** 1 - (disputes_against / total_jobs). 0-1. */
  disputeResilienceRate: z.number(),
  /** verified=1.0, pending=0.5, unverified=0.0. */
  verificationSignal: z.number(),
  totalRatings: z.number(),
  totalJobsAsProf: z.number(),
  completedJobs: z.number(),
  disputesAgainst: z.number()
});
export type ReputationSignals = z.infer<typeof reputationSignalsSchema>;

export const reputationTier = z.enum(["emerging", "growing", "established", "trusted"]);
export type ReputationTier = z.infer<typeof reputationTier>;

export const reputationScoreViewSchema = z.object({
  userId: z.string(),
  /** Composite reputation score 0-100. */
  score: z.number(),
  tier: reputationTier,
  signals: reputationSignalsSchema,
  /** Decay half-life used: 180 days. */
  decayHalfLifeDays: z.number(),
  algorithmVersion: z.string(),
  computedAt: z.string()
});
export type ReputationScoreView = z.infer<typeof reputationScoreViewSchema>;
