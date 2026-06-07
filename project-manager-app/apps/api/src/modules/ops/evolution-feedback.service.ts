import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PatchOutcome = "success" | "partial" | "reverted" | "skipped";

export type PatchFeedback = {
  patchId:      string;
  recId:        string;
  recType:      string;
  recArea:      string;
  filesCreated: string[];
  outcome:      PatchOutcome;
  maturityBefore?: number;
  maturityAfter?:  number;
  note?:        string;
  appliedAt:    string;
  reviewedAt:   string;
  reviewedBy:   string;
};

export type EvolutionFeedbackSummary = {
  totalPatches:     number;
  successRate:      number;
  avgMaturityGain:  number | null;
  topSuccessAreas:  string[];
  topFailureAreas:  string[];
  recentFeedback:   PatchFeedback[];
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class EvolutionFeedbackService {
  private readonly logger = new Logger(EvolutionFeedbackService.name);

  // In-memory store (no new migration needed — usar AuditLog existente como backend)
  private readonly feedbackStore: PatchFeedback[] = [];

  constructor(private readonly prisma: PrismaService) {}

  /** Registrar el resultado de un patch aplicado. */
  async recordFeedback(input: Omit<PatchFeedback, "reviewedAt">): Promise<PatchFeedback> {
    const feedback: PatchFeedback = {
      ...input,
      reviewedAt: new Date().toISOString(),
    };

    this.feedbackStore.push(feedback);

    // Persist en AuditLog para trazabilidad durable
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId:   "system",
          entityType: "EvolutionFeedback",
          entityId:   input.patchId,
          action:     `evolution.patch.${input.outcome}`,
          afterJson:  {
            ...feedback,
            autonomyLevel: 5,
            feedbackLoop: "active",
          },
          occurredAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn(`[EvolFeedback] AuditLog failed: ${(err as Error).message}`);
    }

    this.logger.log(`[EvolFeedback] patchId=${input.patchId} outcome=${input.outcome} area=${input.recArea}`);
    return feedback;
  }

  /** Resumen del feedback loop — qué tipos de patches funcionan mejor. */
  getSummary(): EvolutionFeedbackSummary {
    const total     = this.feedbackStore.length;
    const successes = this.feedbackStore.filter((f) => f.outcome === "success");
    const failures  = this.feedbackStore.filter((f) => f.outcome === "reverted" || f.outcome === "skipped");

    const successRate = total > 0 ? Math.round((successes.length / total) * 100) : 0;

    const gains = successes
      .filter((f) => f.maturityBefore != null && f.maturityAfter != null)
      .map((f) => (f.maturityAfter! - f.maturityBefore!));
    const avgMaturityGain = gains.length > 0
      ? Math.round(gains.reduce((s, g) => s + g, 0) / gains.length)
      : null;

    const successAreas = new Map<string, number>();
    const failureAreas = new Map<string, number>();
    successes.forEach((f) => successAreas.set(f.recArea, (successAreas.get(f.recArea) ?? 0) + 1));
    failures.forEach((f)  => failureAreas.set(f.recArea,  (failureAreas.get(f.recArea)  ?? 0) + 1));

    const topSuccess = [...successAreas.entries()].sort(([, a], [, b]) => b - a).slice(0, 3).map(([k]) => k);
    const topFailure = [...failureAreas.entries()].sort(([, a], [, b]) => b - a).slice(0, 3).map(([k]) => k);

    return {
      totalPatches:    total,
      successRate,
      avgMaturityGain,
      topSuccessAreas: topSuccess,
      topFailureAreas: topFailure,
      recentFeedback:  [...this.feedbackStore].reverse().slice(0, 10),
    };
  }

  /** Lista todos los feedbacks (útil para análisis) */
  getAll(): PatchFeedback[] {
    return [...this.feedbackStore];
  }
}
