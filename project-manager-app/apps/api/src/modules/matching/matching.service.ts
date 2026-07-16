import { Injectable } from "@nestjs/common";
import { publicDisplayName } from "@semse/schemas";
import type {
  MatchCandidateView,
  MatchJobInput,
  MatchPreferredCandidateStatusView,
  MatchPreferredTargetView,
  MatchResultView,
  MatchScoreBreakdown,
} from "@semse/schemas";
import { MATCHING_ALGO_VERSION, rankCandidates, tokenize } from "./matching.algorithm.js";
import { MatchingRepository, type PreferredMatchTarget } from "./matching.repository.js";

export type MatchBriefPreviewInput = {
  title: string;
  scope: string;
  category?: string | null;
  limit?: number;
  minScore?: number;
};

export type PublicProfessionalPreview = {
  userId: string;
  displayName: string;
  publicSlug: string | null;
  score: number;
  percentileRank: number;
  breakdown: MatchScoreBreakdown;
  verificationStatus: string;
  trustScore: number;
  avgRating: number;
  totalRatings: number;
  completedJobs: number;
  completedProjects: number;
  verifiedAt: string | null;
  specialties: string[];
  badges: string[];
  specialtySignal: number;
  matchReason: string;
};

export type PublicProfessionalPreviewResult = {
  briefTitle: string;
  candidatesEvaluated: number;
  candidates: PublicProfessionalPreview[];
  algorithmVersion: string;
  computedAt: string;
};

@Injectable()
export class MatchingService {
  constructor(private readonly matchingRepository: MatchingRepository) {}

  private percentileRank(scores: number[], score: number): number {
    if (scores.length === 0) return 100;
    const below = scores.filter((candidateScore) => candidateScore < score).length;
    return Math.round((below / scores.length) * 100);
  }

  private computePreferredBoost(candidate: MatchCandidateView): number {
    const textSignal = candidate.breakdown.textSimilarity;
    const trustSignal = candidate.breakdown.trustSignal;
    const ratingSignal = candidate.breakdown.ratingSignal;

    if (textSignal === 0 && candidate.completedJobs === 0) {
      return 0;
    }
    if (textSignal >= 0.18) {
      return 0.08;
    }
    if (textSignal >= 0.08 || candidate.completedJobs >= 3) {
      return 0.05;
    }
    if (textSignal > 0 || (candidate.completedJobs > 0 && (trustSignal >= 0.65 || ratingSignal >= 0.6))) {
      return 0.03;
    }
    return 0;
  }

  private applyPreferredTargetBias(
    ranked: MatchCandidateView[],
    preferredTarget: PreferredMatchTarget | null,
    options: { limit: number; minScore: number },
  ): { candidates: MatchCandidateView[]; status: MatchPreferredCandidateStatusView | null } {
    if (!preferredTarget) {
      return { candidates: ranked.filter((candidate) => candidate.score >= options.minScore).slice(0, options.limit), status: null };
    }

    const boosted = ranked.map((candidate) => {
      if (candidate.userId !== preferredTarget.userId) {
        return { ...candidate, isPreferredTarget: false };
      }

      const boost = this.computePreferredBoost(candidate);
      const nextScore = Math.min(1, candidate.score + boost);
      return {
        ...candidate,
        baseScore: candidate.score,
        score: Math.round(nextScore * 1000) / 1000,
        isPreferredTarget: true,
        preferenceBoost: boost > 0 ? Math.round(boost * 1000) / 1000 : undefined,
      };
    });

    const sorted = [...boosted].sort((left, right) => right.score - left.score);
    const scoreVector = sorted.map((candidate) => candidate.score);
    const reranked = sorted.map((candidate) => ({
      ...candidate,
      percentileRank: this.percentileRank(scoreVector, candidate.score),
    }));
    const filtered = reranked.filter((candidate) => candidate.score >= options.minScore);
    const finalCandidates = filtered.slice(0, options.limit);

    const preferredCandidate = reranked.find((candidate) => candidate.userId === preferredTarget.userId);
    if (!preferredCandidate) {
      return {
        candidates: finalCandidates,
        status: {
          state: "not_available",
          reason: "El profesional objetivo no aparece entre los candidatos activos del tenant.",
        },
      };
    }

    const rank = reranked.findIndex((candidate) => candidate.userId === preferredTarget.userId) + 1;
    const inResults = finalCandidates.some((candidate) => candidate.userId === preferredTarget.userId);
    const boostedBy = preferredCandidate.preferenceBoost;

    if (inResults && boostedBy) {
      return {
        candidates: finalCandidates,
        status: {
          state: "boosted",
          reason: "El profesional objetivo subio posiciones por historial real del trabajo y preferencia explicita.",
          rank,
          score: preferredCandidate.score,
          boostedBy,
        },
      };
    }

    if (inResults) {
      return {
        candidates: finalCandidates,
        status: {
          state: "in_results",
          reason: "El profesional objetivo entro al ranking por score propio, sin empuje artificial.",
          rank,
          score: preferredCandidate.score,
        },
      };
    }

    if (!boostedBy && preferredCandidate.score < options.minScore) {
      return {
        candidates: finalCandidates,
        status: {
          state: "insufficient_signal",
          reason: "El profesional objetivo no reunio senales suficientes para entrar con este brief.",
          rank,
          score: preferredCandidate.score,
        },
      };
    }

    return {
      candidates: finalCandidates,
      status: {
        state: "out_of_range",
        reason: "El profesional objetivo existe, pero quedo fuera del rango final de resultados.",
        rank,
        score: preferredCandidate.score,
        boostedBy,
      },
    };
  }

  private computeSpecialtySignal(category: string | null | undefined, specialties: string[]): number {
    const categoryTokens = tokenize(category ?? "");
    const specialtyTokens = tokenize(specialties.join(" "));

    if (categoryTokens.size === 0 || specialtyTokens.size === 0) {
      return 0;
    }

    let matches = 0;
    for (const token of specialtyTokens) {
      if (categoryTokens.has(token)) matches++;
    }

    return matches === 0 ? 0 : matches / specialtyTokens.size;
  }

  private describePreviewReason(candidate: {
    breakdown: MatchScoreBreakdown;
    completedJobs: number;
    verificationStatus: string;
    trustScore: number;
  }, specialtySignal: number): string {
    if (specialtySignal >= 0.5) return "Especialidad alineada al tipo de trabajo";
    if (candidate.breakdown.textSimilarity >= 0.2) return "Historial parecido al brief";
    if (candidate.completedJobs >= 3) return "Experiencia operativa previa";
    if (candidate.verificationStatus === "verified" && candidate.trustScore >= 80) return "Alta confianza verificada";
    return "Señales operativas parciales";
  }

  async matchJob(
    tenantId: string,
    input: MatchJobInput
  ): Promise<MatchResultView> {
    const [job, candidates, preferredTarget] = await Promise.all([
      this.matchingRepository.findJobOrThrow(tenantId, input.jobId),
      this.matchingRepository.loadCandidates(tenantId),
      this.matchingRepository.loadPreferredTargetForJob(tenantId, input.jobId),
    ]);

    const ranked = rankCandidates(
      job.title,
      job.scope,
      job.category,
      candidates,
      { limit: Math.max(input.limit ?? 10, candidates.length || 0), minScore: 0 }
    );
    const biasResult = this.applyPreferredTargetBias(ranked, preferredTarget, {
      limit: input.limit ?? 10,
      minScore: input.minScore ?? 0,
    });

    return {
      jobId: job.id,
      jobTitle: job.title,
      candidatesEvaluated: candidates.length,
      candidates: biasResult.candidates,
      preferredTarget: preferredTarget as MatchPreferredTargetView | null,
      preferredCandidateStatus: biasResult.status,
      algorithmVersion: MATCHING_ALGO_VERSION,
      computedAt: new Date().toISOString()
    };
  }

  async previewBrief(
    tenantId: string,
    input: MatchBriefPreviewInput,
  ): Promise<PublicProfessionalPreviewResult> {
    const requestedLimit = input.limit ?? 3;
    const candidates = await this.matchingRepository.loadCandidates(tenantId);
    const ranked = rankCandidates(
      input.title,
      input.scope,
      input.category ?? null,
      candidates,
      { limit: Math.max(requestedLimit * 3, requestedLimit), minScore: input.minScore ?? 0 },
    );
    const profiles = await this.matchingRepository.loadPublicCandidateProfiles(
      ranked.map((candidate) => candidate.userId),
    );
    const previewed = ranked.map((candidate) => {
      const profile = profiles.get(candidate.userId);
      const specialties = profile?.specialties ?? [];
      const specialtySignal = this.computeSpecialtySignal(input.category, specialties);
      const score = Math.round(((candidate.score * 0.85) + (specialtySignal * 0.15)) * 1000) / 1000;

      return {
        userId: candidate.userId,
        // Superficie pública anónima: jamás exponer el email del candidato,
        // ni como campo ni como displayName de fallback.
        displayName: publicDisplayName(profile?.displayName, "Profesional verificado"),
        publicSlug: profile?.publicSlug ?? null,
        score,
        percentileRank: candidate.percentileRank,
        breakdown: candidate.breakdown,
        verificationStatus: candidate.verificationStatus,
        trustScore: profile?.trustScore ?? Math.round(candidate.trustScore * 100),
        avgRating: profile?.avgClientRating ?? candidate.avgRating,
        totalRatings: candidate.totalRatings,
        completedJobs: candidate.completedJobs,
        completedProjects: profile?.completedProjects ?? candidate.completedJobs,
        verifiedAt: profile?.verifiedAt ?? null,
        specialties,
        badges: profile?.badges ?? [],
        specialtySignal,
        matchReason: this.describePreviewReason(candidate, specialtySignal),
      };
    });

    return {
      briefTitle: input.title,
      candidatesEvaluated: candidates.length,
      candidates: previewed
        .filter((candidate) =>
          candidate.breakdown.textSimilarity > 0
          || candidate.specialtySignal > 0
          || candidate.completedJobs > 0,
        )
        .sort((left, right) => right.score - left.score)
        .slice(0, requestedLimit),
      algorithmVersion: MATCHING_ALGO_VERSION,
      computedAt: new Date().toISOString(),
    };
  }
}
