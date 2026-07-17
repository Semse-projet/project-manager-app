import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { RiskScoringService } from "./risk-scoring.service.js";

export type PmoAlertLevel = "critical" | "high" | "medium" | "info";

export type PmoAlert = {
  id: string;
  projectId: string;
  projectTitle: string;
  level: PmoAlertLevel;
  category: "dispute" | "budget" | "schedule" | "escrow" | "evidence" | "stale";
  message: string;
  action: string;
  detectedAt: string;
};

export type PmoProjectCard = {
  projectId: string;
  jobTitle: string;
  status: string;
  contractorOrg: string;
  riskScore: number;
  riskLevel: string;
  escrowFunded: number;
  pendingRelease: number;
  openDisputes: number;
  pendingMilestones: number;
  pendingEvidence: number;
  daysSinceActivity: number;
  alerts: PmoAlert[];
};

export type PmoDashboard = {
  tenantId: string;
  generatedAt: string;
  summary: {
    totalProjects: number;
    activeProjects: number;
    totalEscrow: number;
    pendingRelease: number;
    criticalProjects: number;
    highRiskProjects: number;
    openDisputes: number;
    totalAlerts: number;
  };
  projects: PmoProjectCard[];
  topAlerts: PmoAlert[];
};

function toNum(v: unknown): number {
  return parseFloat(String(v ?? 0)) || 0;
}

@Injectable()
export class PmoService {
  private readonly logger = new Logger(PmoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly riskService: RiskScoringService,
  ) {}

  async getDashboard(tenantId: string): Promise<PmoDashboard> {
    const [projects, allDisputes, allEscrows] = await Promise.all([
      this.prisma.project.findMany({
        where: { tenantId, status: { in: ["OPEN", "IN_PROGRESS"] } },
        include: {
          job: { select: { title: true, category: true } },
          assignedProOrg: { select: { name: true } },
          milestones: { select: { status: true, updatedAt: true } },
          evidence: { select: { validationStatus: true } },
          disputes: { select: { status: true } },
          escrow: { select: { totalAmount: true, status: true, transactions: { select: { type: true, amount: true, status: true } } } },
        },
        take: 50,
      }),
      this.prisma.dispute.count({ where: { tenantId, status: { in: ["OPEN", "ASSIGNED", "UNDER_REVIEW"] } } }),
      this.prisma.paymentEscrow.aggregate({
        where: { project: { tenantId } },
        _sum: { totalAmount: true },
      }),
    ]);

    const projectCards: PmoProjectCard[] = [];

    for (const proj of projects) {
      let riskScore = 0;
      let riskLevel = "low";

      try {
        const rs = await this.riskService.calculateProjectRisk(tenantId, proj.id);
        riskScore = rs.overallScore;
        riskLevel = rs.level;
      } catch { /* skip if risk calc fails */ }

      const escrowTotal = toNum(proj.escrow?.totalAmount);
      const releasedTxns = (proj.escrow?.transactions ?? []).filter(
        (t: { type: string; status: string }) => t.type === "RELEASE" && t.status === "COMPLETED"
      );
      const escrowReleased = releasedTxns.reduce((s: number, t: { amount: unknown }) => s + toNum(t.amount), 0);
      const pendingRelease = Math.max(0, escrowTotal - escrowReleased);

      const openDisputes = proj.disputes.filter((d: { status: string }) => ["OPEN", "ASSIGNED", "UNDER_REVIEW"].includes(d.status)).length;
      const pendingMilestones = proj.milestones.filter((m: { status: string }) => ["DRAFT", "SUBMITTED", "AWAITING_REVIEW"].includes(m.status)).length;
      const pendingEvidence = proj.evidence.filter((e: { validationStatus: string | null }) => e.validationStatus === "pending").length;

      const lastActivity = proj.milestones.length > 0
        ? Math.max(...proj.milestones.map((m: { updatedAt: Date }) => new Date(m.updatedAt).getTime()))
        : new Date(proj.updatedAt).getTime();
      const daysSinceActivity = Math.floor((Date.now() - lastActivity) / (1000 * 60 * 60 * 24));

      const alerts = this.generateProjectAlerts(proj.id, proj.job.title, {
        riskScore, riskLevel, openDisputes, pendingMilestones,
        pendingEvidence, daysSinceActivity, escrowTotal, pendingRelease,
      });

      projectCards.push({
        projectId: proj.id,
        jobTitle: proj.job.title,
        status: proj.status,
        contractorOrg: proj.assignedProOrg.name,
        riskScore, riskLevel,
        escrowFunded: escrowTotal,
        pendingRelease,
        openDisputes,
        pendingMilestones,
        pendingEvidence,
        daysSinceActivity,
        alerts,
      });
    }

    projectCards.sort((a, b) => b.riskScore - a.riskScore);

    const totalEscrow = toNum(allEscrows._sum.totalAmount);
    const allAlerts = projectCards.flatMap(p => p.alerts);
    const topAlerts = allAlerts
      .sort((a, b) => {
        const order: Record<PmoAlertLevel, number> = { critical: 0, high: 1, medium: 2, info: 3 };
        return order[a.level] - order[b.level];
      })
      .slice(0, 10);

    this.logger.log(`[pmo] dashboard built tenantId=${tenantId} projects=${projects.length} alerts=${allAlerts.length}`);

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalProjects: projects.length,
        activeProjects: projects.filter((p: { status: string }) => p.status === "IN_PROGRESS").length,
        totalEscrow,
        pendingRelease: projectCards.reduce((s, p) => s + p.pendingRelease, 0),
        criticalProjects: projectCards.filter(p => p.riskLevel === "critical").length,
        highRiskProjects: projectCards.filter(p => ["high", "critical"].includes(p.riskLevel)).length,
        openDisputes: allDisputes,
        totalAlerts: allAlerts.length,
      },
      projects: projectCards,
      topAlerts,
    };
  }

  private generateProjectAlerts(
    projectId: string,
    jobTitle: string,
    data: {
      riskScore: number; riskLevel: string; openDisputes: number;
      pendingMilestones: number; pendingEvidence: number; daysSinceActivity: number;
      escrowTotal: number; pendingRelease: number;
    },
  ): PmoAlert[] {
    const alerts: PmoAlert[] = [];
    const now = new Date().toISOString();

    if (data.openDisputes > 0) {
      alerts.push({
        id: `${projectId}-dispute`,
        projectId, projectTitle: jobTitle,
        level: data.openDisputes > 1 ? "critical" : "high",
        category: "dispute",
        message: `${data.openDisputes} disputa(s) activa(s) bloquean liberación de fondos`,
        action: "Revisar disputas y coordinar resolución",
        detectedAt: now,
      });
    }

    if (data.riskScore >= 70) {
      alerts.push({
        id: `${projectId}-risk-critical`,
        projectId, projectTitle: jobTitle,
        level: "critical",
        category: "budget",
        message: `Riesgo crítico (${data.riskScore}/100): intervención inmediata requerida`,
        action: "Revisar score de riesgo y ejecutar plan de mitigación",
        detectedAt: now,
      });
    } else if (data.riskScore >= 50) {
      alerts.push({
        id: `${projectId}-risk-high`,
        projectId, projectTitle: jobTitle,
        level: "high",
        category: "budget",
        message: `Riesgo elevado (${data.riskScore}/100)`,
        action: "Monitorear de cerca — revisar gastos y agenda",
        detectedAt: now,
      });
    }

    if (data.pendingEvidence > 3) {
      alerts.push({
        id: `${projectId}-evidence`,
        projectId, projectTitle: jobTitle,
        level: "medium",
        category: "evidence",
        message: `${data.pendingEvidence} evidencias sin revisar — hitos bloqueados`,
        action: "Revisar y aprobar evidencias pendientes",
        detectedAt: now,
      });
    }

    if (data.daysSinceActivity > 10 && data.pendingMilestones > 0) {
      alerts.push({
        id: `${projectId}-stale`,
        projectId, projectTitle: jobTitle,
        level: data.daysSinceActivity > 21 ? "high" : "medium",
        category: "stale",
        message: `Sin actividad hace ${data.daysSinceActivity} días con ${data.pendingMilestones} hito(s) pendientes`,
        action: "Contactar profesional — proyecto puede estar estancado",
        detectedAt: now,
      });
    }

    if (data.pendingRelease > 0 && data.openDisputes === 0) {
      alerts.push({
        id: `${projectId}-escrow-ready`,
        projectId, projectTitle: jobTitle,
        level: "info",
        category: "escrow",
        message: `$${data.pendingRelease.toLocaleString()} listos para liberar`,
        action: "Aprobar liberación de escrow si hitos están completos",
        detectedAt: now,
      });
    }

    return alerts;
  }
}
