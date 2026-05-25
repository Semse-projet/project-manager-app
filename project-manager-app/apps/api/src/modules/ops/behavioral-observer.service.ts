import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { computeReputation } from "../ratings/reputation.algorithm.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BehavioralAlert = {
  level: "critical" | "high" | "medium" | "info";
  area: string;
  signal: string;
  recommendation: string;
};

export type BehavioralHealth = {
  observedAt: string;
  tenantId: string;

  users: {
    totalActive: number;
    verification: {
      unverified: number;
      pending: number;
      verified: number;
      suspended: number;
    };
    trustRisk: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
    flagged: number;
  };

  reputation: {
    /** Distribution across tier buckets for professionals with ≥1 job. */
    tierDistribution: {
      emerging: number;
      growing: number;
      established: number;
      trusted: number;
    };
    avgScore: number;
    scoredProfessionals: number;
  };

  governance: {
    openDisputes: number;
    /** open disputes / max(1, active jobs) */
    openDisputeRate: number;
    /** resolved / max(1, resolved + open) */
    disputeResolutionRate: number;
    /** true when last-7d dispute count > prior-7d * 1.5 */
    recentDisputeSurge: boolean;
  };

  market: {
    activeJobs: number;
    recentJobsPosted: number;
    recentJobsCompleted: number;
    staleJobs: number;
  };

  alerts: BehavioralAlert[];
  behavioralScore: number;
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class BehavioralObserverService {
  private readonly logger = new Logger(BehavioralObserverService.name);

  constructor(private readonly prisma: PrismaService) {}

  async observe(tenantId: string): Promise<BehavioralHealth> {
    const observedAt = new Date().toISOString();
    const now = new Date();
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const day14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      users,
      recentJobsPosted,
      recentJobsCompleted,
      activeJobs,
      staleJobs,
      openDisputes,
      resolvedDisputes,
      last7dDisputes,
      prior7dDisputes,
      professionals,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { status: "active" },
        select: { id: true, verificationStatus: true, riskLevel: true, flags: true },
      }),
      this.prisma.job.count({
        where: { tenantId, createdAt: { gte: day7 }, deletedAt: null },
      }),
      this.prisma.job.count({
        where: { tenantId, status: "COMPLETED", updatedAt: { gte: day7 }, deletedAt: null },
      }),
      this.prisma.job.count({
        where: { tenantId, status: { in: ["ACCEPTED", "IN_PROGRESS", "RESERVED"] }, deletedAt: null },
      }),
      this.prisma.job.count({
        where: { tenantId, status: "PUBLISHED", createdAt: { lt: day30 }, deletedAt: null },
      }),
      this.prisma.dispute.count({
        where: { tenantId, status: "OPEN", deletedAt: null },
      }),
      this.prisma.dispute.count({
        where: { tenantId, status: "RESOLVED", deletedAt: null },
      }),
      this.prisma.dispute.count({
        where: { tenantId, createdAt: { gte: day7 }, deletedAt: null },
      }),
      this.prisma.dispute.count({
        where: { tenantId, createdAt: { gte: day14, lt: day7 }, deletedAt: null },
      }),
      // Professionals: users with at least 1 reservation (they are workers/pros)
      this.prisma.jobReservation.findMany({
        where: { job: { tenantId } },
        distinct: ["professionalId"],
        select: {
          professionalId: true,
          job: { select: { tenantId: true } },
        },
        take: 200,
      }),
    ]);

    // ── User distribution ─────────────────────────────────────────────────

    const verification = { unverified: 0, pending: 0, verified: 0, suspended: 0 };
    const trustRisk = { low: 0, medium: 0, high: 0, critical: 0 };
    let flagged = 0;

    for (const u of users) {
      const vs = u.verificationStatus as keyof typeof verification;
      if (vs in verification) verification[vs]++;

      const rl = u.riskLevel as keyof typeof trustRisk;
      if (rl in trustRisk) trustRisk[rl]++;

      if ((u.flags as string[]).length > 0) flagged++;
    }

    // ── Reputation distribution ───────────────────────────────────────────

    const tierDistribution = { emerging: 0, growing: 0, established: 0, trusted: 0 };
    let totalScore = 0;
    let scored = 0;

    // Compute reputation for up to 100 professionals (sample for performance)
    const profIds = [...new Set(professionals.map((p) => p.professionalId))].slice(0, 100);

    if (profIds.length > 0) {
      const [ratingRows, completionRows] = await Promise.all([
        this.prisma.rating.findMany({
          where: { toUserId: { in: profIds }, job: { tenantId } },
          select: { toUserId: true, score: true, createdAt: true },
        }),
        this.prisma.jobReservation.findMany({
          where: { professionalId: { in: profIds }, job: { tenantId } },
          select: {
            professionalId: true,
            job: { select: { status: true, tenantId: true } },
          },
        }),
      ]);

      for (const profId of profIds) {
        const ratings = ratingRows
          .filter((r) => r.toUserId === profId)
          .map((r) => ({ score: r.score as number, createdAt: r.createdAt }));

        const jobs = completionRows.filter((r) => r.professionalId === profId);
        const completed = jobs.filter((r) => r.job?.status === "COMPLETED").length;

        const profUser = users.find((u) => u.id === profId);

        const result = computeReputation({
          userId: profId,
          verificationStatus: profUser?.verificationStatus ?? "unverified",
          ratings,
          totalJobsAsProfessional: jobs.length,
          completedJobs: completed,
          disputesAgainst: 0, // skipped for perf in batch; dispute rate computed separately
        });

        const tier = result.tier as keyof typeof tierDistribution;
        if (tier in tierDistribution) tierDistribution[tier]++;
        totalScore += result.score;
        scored++;
      }
    }

    // ── Governance signals ────────────────────────────────────────────────

    const disputeResolutionRate =
      resolvedDisputes + openDisputes > 0
        ? resolvedDisputes / (resolvedDisputes + openDisputes)
        : 1;

    const openDisputeRate =
      activeJobs > 0 ? openDisputes / activeJobs : 0;

    const recentDisputeSurge = prior7dDisputes > 0
      ? last7dDisputes > prior7dDisputes * 1.5
      : last7dDisputes > 5;

    // ── Alerts ────────────────────────────────────────────────────────────

    const alerts = this.generateAlerts({
      verification, trustRisk, flagged,
      openDisputeRate, recentDisputeSurge,
      disputeResolutionRate, openDisputes,
      staleJobs, tierDistribution, scored,
    });

    const behavioralScore = this.computeScore({
      trustRisk, flagged, totalActive: users.length,
      openDisputeRate, disputeResolutionRate, recentDisputeSurge,
      staleJobs, activeJobs,
    });

    const result: BehavioralHealth = {
      observedAt,
      tenantId,
      users: { totalActive: users.length, verification, trustRisk, flagged },
      reputation: {
        tierDistribution,
        avgScore: scored > 0 ? Math.round((totalScore / scored) * 10) / 10 : 0,
        scoredProfessionals: scored,
      },
      governance: {
        openDisputes, openDisputeRate: Math.round(openDisputeRate * 1000) / 1000,
        disputeResolutionRate: Math.round(disputeResolutionRate * 1000) / 1000,
        recentDisputeSurge,
      },
      market: { activeJobs, recentJobsPosted, recentJobsCompleted, staleJobs },
      alerts,
      behavioralScore,
    };

    this.logger.log(
      `[BehavioralObserver] tenantId=${tenantId} score=${behavioralScore} users=${users.length} disputes=${openDisputes} surge=${recentDisputeSurge}`,
    );

    return result;
  }

  // ── Alerts ────────────────────────────────────────────────────────────────

  private generateAlerts(signals: {
    verification: BehavioralHealth["users"]["verification"];
    trustRisk: BehavioralHealth["users"]["trustRisk"];
    flagged: number;
    openDisputeRate: number;
    recentDisputeSurge: boolean;
    disputeResolutionRate: number;
    openDisputes: number;
    staleJobs: number;
    tierDistribution: BehavioralHealth["reputation"]["tierDistribution"];
    scored: number;
  }): BehavioralAlert[] {
    const alerts: BehavioralAlert[] = [];

    if (signals.trustRisk.critical > 0) {
      alerts.push({
        level: "critical",
        area: "User Trust",
        signal: `${signals.trustRisk.critical} usuario(s) con riesgo crítico activo`,
        recommendation: "Revisar cuentas en riesgo crítico — posible fraude o incumplimiento",
      });
    }

    if (signals.flagged > 5) {
      alerts.push({
        level: "high",
        area: "User Trust",
        signal: `${signals.flagged} usuario(s) con flags activos`,
        recommendation: "Auditar flags: fraud_suspect, under_review",
      });
    }

    if (signals.trustRisk.high > 10) {
      alerts.push({
        level: "medium",
        area: "User Trust",
        signal: `${signals.trustRisk.high} usuarios con riesgo alto`,
        recommendation: "Considerar revisión manual de los perfiles de mayor riesgo",
      });
    }

    if (signals.verification.pending > 20) {
      alerts.push({
        level: "medium",
        area: "Verification",
        signal: `${signals.verification.pending} usuarios en estado pending de verificación`,
        recommendation: "Revisar backlog de verificación — puede estar bloqueando profesionales legítimos",
      });
    }

    if (signals.recentDisputeSurge) {
      alerts.push({
        level: "high",
        area: "Governance",
        signal: "Surge de disputas detectado: últimos 7 días superan 150% de los 7 días previos",
        recommendation: "Investigar causa — posible problema sistémico de calidad o comunicación",
      });
    }

    if (signals.openDisputeRate > 0.15) {
      alerts.push({
        level: "high",
        area: "Governance",
        signal: `Tasa de disputas abiertas elevada: ${Math.round(signals.openDisputeRate * 100)}% de los jobs activos`,
        recommendation: "Alta tasa sugiere problemas de calidad, scope o comunicación en la plataforma",
      });
    } else if (signals.openDisputeRate > 0.08) {
      alerts.push({
        level: "medium",
        area: "Governance",
        signal: `Tasa de disputas: ${Math.round(signals.openDisputeRate * 100)}% — por encima del umbral saludable (8%)`,
        recommendation: "Monitorear tendencia — revisar si hay categorías o profesionales recurrentes",
      });
    }

    if (signals.disputeResolutionRate < 0.5 && signals.openDisputes > 3) {
      alerts.push({
        level: "medium",
        area: "Governance",
        signal: `Tasa de resolución de disputas baja: ${Math.round(signals.disputeResolutionRate * 100)}%`,
        recommendation: "Acelerar resolución de disputas abiertas para liberar confianza en la plataforma",
      });
    }

    if (signals.staleJobs > 10) {
      alerts.push({
        level: "medium",
        area: "Market Health",
        signal: `${signals.staleJobs} jobs sin actividad por más de 30 días`,
        recommendation: "Revisar jobs estancados — pueden indicar abandono o problemas de matching",
      });
    }

    if (signals.scored > 10 && signals.tierDistribution.emerging / signals.scored > 0.7) {
      alerts.push({
        level: "info",
        area: "Reputation Economy",
        signal: "Más del 70% de los profesionales están en tier 'emerging'",
        recommendation:
          "Pool de profesionales mayormente nuevo — aumentar incentivos de completar primeros trabajos",
      });
    }

    return alerts;
  }

  // ── Score ─────────────────────────────────────────────────────────────────

  private computeScore(signals: {
    trustRisk: BehavioralHealth["users"]["trustRisk"];
    flagged: number;
    totalActive: number;
    openDisputeRate: number;
    disputeResolutionRate: number;
    recentDisputeSurge: boolean;
    staleJobs: number;
    activeJobs: number;
  }): number {
    let score = 100;

    score -= signals.trustRisk.critical * 20;
    score -= signals.trustRisk.high * 3;
    score -= Math.min(signals.flagged * 2, 15);
    score -= Math.round(signals.openDisputeRate * 100) * 2;
    if (signals.recentDisputeSurge) score -= 15;
    if (signals.disputeResolutionRate < 0.5) score -= 10;
    score -= Math.min(signals.staleJobs, 20);

    return Math.max(0, Math.min(100, score));
  }
}
