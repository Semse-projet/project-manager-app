/**
 * Matching algorithm — pure functions, no I/O.
 *
 * Score formula (weights sum to 1.0):
 *   textSimilarity   × 0.40  — Jaccard on bag-of-words tokens
 *   trustSignal      × 0.25  — User.trustScore (0-1)
 *   verificationSignal × 0.15 — verified=1, pending=0.5, unverified=0
 *   ratingSignal     × 0.20  — avgRating/5
 *
 * Complexity: O(|T|) tokenize target + O(n × |H|) score n candidates
 * where |H| is average historical job text length per candidate.
 *
 * Algorithm version: v1.0
 */

import type { MatchCandidateView, MatchScoreBreakdown } from "@semse/schemas";

export const MATCHING_ALGO_VERSION = "v1.0";

const WEIGHTS = {
  text: 0.40,
  trust: 0.25,
  verification: 0.15,
  rating: 0.20
} as const;

// Stop words to exclude from token matching
const STOP_WORDS = new Set([
  "de", "la", "el", "en", "y", "a", "los", "las", "un", "una", "con", "por",
  "para", "que", "del", "al", "se", "su", "sus", "es", "son", "ser", "fue",
  "the", "and", "for", "with", "this", "that", "from", "have", "are", "was"
]);

const VERIFICATION_SCORE: Record<string, number> = {
  verified: 1.0,
  pending: 0.5,
  unverified: 0.0,
  suspended: 0.0
};

export type CandidateInput = {
  userId: string;
  email: string;
  trustScore: number;
  verificationStatus: string;
  avgRating: number;
  totalRatings: number;
  completedJobs: number;
  /** Concatenated text of all past completed job titles + scopes for this user. */
  historicalJobText: string;
};

/** Tokenize text into a normalized bag-of-words set. */
export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOP_WORDS.has(t))
  );
}

/** Jaccard similarity between two token sets. O(|a| + |b|). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersectionCount = 0;
  for (const token of a) {
    if (b.has(token)) intersectionCount++;
  }
  const unionSize = a.size + b.size - intersectionCount;
  return unionSize === 0 ? 0 : intersectionCount / unionSize;
}

/** Score a single candidate against a job token set. */
export function scoreCandidate(
  jobTokens: Set<string>,
  candidate: CandidateInput
): MatchScoreBreakdown & { composite: number } {
  const candidateTokens = tokenize(candidate.historicalJobText);
  const textSimilarity = jaccard(jobTokens, candidateTokens);
  const trustSignal = Math.min(1, Math.max(0, candidate.trustScore));
  const verificationSignal = VERIFICATION_SCORE[candidate.verificationStatus] ?? 0;
  const ratingSignal = candidate.totalRatings > 0 ? Math.min(1, candidate.avgRating / 5) : 0;

  const composite =
    WEIGHTS.text * textSimilarity +
    WEIGHTS.trust * trustSignal +
    WEIGHTS.verification * verificationSignal +
    WEIGHTS.rating * ratingSignal;

  return { textSimilarity, trustSignal, verificationSignal, ratingSignal, composite };
}

/** Compute percentile rank for each score in the list. */
function percentileRank(scores: number[], score: number): number {
  if (scores.length === 0) return 100;
  const below = scores.filter((s) => s < score).length;
  return Math.round((below / scores.length) * 100);
}

/**
 * Rank all candidates for a job.
 * Returns sorted descending by composite score, filtered by minScore.
 */
export function rankCandidates(
  jobTitle: string,
  jobScope: string,
  jobCategory: string | null,
  candidates: CandidateInput[],
  options: { limit: number; minScore: number }
): MatchCandidateView[] {
  const jobText = [jobTitle, jobCategory ?? "", jobScope].join(" ");
  const jobTokens = tokenize(jobText);

  const scored = candidates.map((c) => {
    const { composite, ...breakdown } = scoreCandidate(jobTokens, c);
    return { candidate: c, composite, breakdown };
  });

  const allScores = scored.map((s) => s.composite);

  return scored
    .filter((s) => s.composite >= options.minScore)
    .sort((a, b) => b.composite - a.composite)
    .slice(0, options.limit)
    .map((s) => ({
      userId: s.candidate.userId,
      email: s.candidate.email,
      score: Math.round(s.composite * 1000) / 1000,
      percentileRank: percentileRank(allScores, s.composite),
      breakdown: {
        textSimilarity: Math.round(s.breakdown.textSimilarity * 1000) / 1000,
        trustSignal: Math.round(s.breakdown.trustSignal * 1000) / 1000,
        verificationSignal: s.breakdown.verificationSignal,
        ratingSignal: Math.round(s.breakdown.ratingSignal * 1000) / 1000
      },
      verificationStatus: s.candidate.verificationStatus,
      trustScore: Math.round(s.candidate.trustScore * 1000) / 1000,
      avgRating: Math.round(s.candidate.avgRating * 100) / 100,
      totalRatings: s.candidate.totalRatings,
      completedJobs: s.candidate.completedJobs
    }));
}
