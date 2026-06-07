import { z } from "zod";

// ── Input ──────────────────────────────────────────────────────────────────────

export const matchJobInputSchema = z.object({
  jobId: z.string().min(1),
  /** Max candidates to return. Default 10, max 50. */
  limit: z.number().int().min(1).max(50).default(10),
  /** Only return candidates with score >= minScore (0-1). Default 0. */
  minScore: z.number().min(0).max(1).default(0)
});
export type MatchJobInput = z.infer<typeof matchJobInputSchema>;

// ── Output ─────────────────────────────────────────────────────────────────────

export const matchScoreBreakdownSchema = z.object({
  /** Jaccard text similarity on job title+scope tokens vs candidate job history. 0-1. */
  textSimilarity: z.number(),
  /** User trust score 0-1 (from User.trustScore field). */
  trustSignal: z.number(),
  /** Verification level: verified=1, pending=0.5, unverified=0. */
  verificationSignal: z.number(),
  /** Avg rating / 5. 0-1. 0 if no ratings yet. */
  ratingSignal: z.number()
});
export type MatchScoreBreakdown = z.infer<typeof matchScoreBreakdownSchema>;

export const matchCandidateViewSchema = z.object({
  userId: z.string(),
  email: z.string(),
  /** Composite match score 0-1. Higher = better fit. */
  score: z.number(),
  /** Score before any preferred-target boost. */
  baseScore: z.number().optional(),
  /** Percentile rank 0-100 among all candidates evaluated. */
  percentileRank: z.number(),
  breakdown: matchScoreBreakdownSchema,
  verificationStatus: z.string(),
  trustScore: z.number(),
  avgRating: z.number(),
  totalRatings: z.number(),
  completedJobs: z.number(),
  isPreferredTarget: z.boolean().optional(),
  preferenceBoost: z.number().optional(),
});
export type MatchCandidateView = z.infer<typeof matchCandidateViewSchema>;

export const matchPreferredTargetViewSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  publicSlug: z.string().nullable().optional(),
  source: z.enum(["job_memory"]),
});
export type MatchPreferredTargetView = z.infer<typeof matchPreferredTargetViewSchema>;

export const matchPreferredCandidateStatusSchema = z.object({
  state: z.enum(["boosted", "in_results", "out_of_range", "insufficient_signal", "not_available"]),
  reason: z.string(),
  rank: z.number().int().positive().optional(),
  score: z.number().optional(),
  boostedBy: z.number().optional(),
});
export type MatchPreferredCandidateStatusView = z.infer<typeof matchPreferredCandidateStatusSchema>;

export const matchResultViewSchema = z.object({
  jobId: z.string(),
  jobTitle: z.string(),
  candidatesEvaluated: z.number(),
  candidates: z.array(matchCandidateViewSchema),
  preferredTarget: matchPreferredTargetViewSchema.nullable().optional(),
  preferredCandidateStatus: matchPreferredCandidateStatusSchema.nullable().optional(),
  algorithmVersion: z.string(),
  computedAt: z.string()
});
export type MatchResultView = z.infer<typeof matchResultViewSchema>;
