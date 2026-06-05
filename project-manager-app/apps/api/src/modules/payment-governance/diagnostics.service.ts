import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MilestoneBlockerDiagnostic {
  milestoneId: string;
  releaseStatus: "blocked" | "ready" | "released";
  canRelease: boolean;
  blockers: string[];
  missingEvidenceTypes: string[];
  rejectedEvidenceCount: number;
  needsReuploadEvidenceIds: string[];
  pendingChangeOrderCount: number;
  criticalOperationalSignals: string[];
  auditReason: string;
  nextBestAction: string;
}

export interface PaymentGovernanceDiagnostics {
  analyzedAt: string;
  totalMilestones: number;
  blockedCount: number;
  readyCount: number;
  releasedCount: number;
  blockedMilestones: MilestoneBlockerDiagnostic[];
}

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable()
export class PaymentGovernanceDiagnosticsService {
  private readonly logger = new Logger(PaymentGovernanceDiagnosticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDiagnostics(tenantId: string): Promise<PaymentGovernanceDiagnostics> {
    try {
      const milestones = await this.prisma.milestone.findMany({
        where: { project: { tenantId } },
        select: {
          id: true,
          title: true,
          paymentReadiness: true,
          paymentAmount: true,
          createdAt: true,
          project: { select: { id: true } },
        },
        take: 100,
      });

      const blockedMilestones: MilestoneBlockerDiagnostic[] = [];

      for (const milestone of milestones) {
        const readiness = milestone.paymentReadiness as string | null;
        if (readiness === "blocked" || readiness === "not_ready") {
          const diagnostic = await this.diagnoseMilestoneBlocks(tenantId, milestone.id, milestone.title);
          blockedMilestones.push(diagnostic);
        }
      }

      const blockedCount = milestones.filter((m) => {
        const r = m.paymentReadiness as string | null;
        return r === "blocked" || r === "not_ready";
      }).length;

      const readyCount = milestones.filter((m) => {
        const r = m.paymentReadiness as string | null;
        return r === "ready";
      }).length;

      const releasedCount = milestones.filter((m) => {
        const r = m.paymentReadiness as string | null;
        return r === "released";
      }).length;

      return {
        analyzedAt: new Date().toISOString(),
        totalMilestones: milestones.length,
        blockedCount,
        readyCount,
        releasedCount,
        blockedMilestones,
      };
    } catch (error) {
      this.logger.error("Diagnostics failed", { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private async diagnoseMilestoneBlocks(
    tenantId: string,
    milestoneId: string,
    milestoneTitle: string,
  ): Promise<MilestoneBlockerDiagnostic> {
    const blockers: string[] = [];
    const missingEvidenceTypes: string[] = [];
    let rejectedEvidenceCount = 0;
    const needsReuploadEvidenceIds: string[] = [];
    let pendingChangeOrderCount = 0;
    const criticalOperationalSignals: string[] = [];

    // Check evidence status
    try {
      const evidenceCount = await this.prisma.evidence.count({
        where: { tenantId, milestone: { id: milestoneId } },
      });

      const rejectedEvidence = await this.prisma.evidence.findMany({
        where: { tenantId, milestone: { id: milestoneId }, reviewStatus: "rejected" },
        select: { id: true, type: true },
        take: 10,
      });

      rejectedEvidenceCount = rejectedEvidence.length;
      if (rejectedEvidenceCount > 0) {
        blockers.push("rejected_evidence");
        rejectedEvidence.forEach((e) => needsReuploadEvidenceIds.push(e.id));
        // Infer missing types from rejected
        const types = [...new Set(rejectedEvidence.map((e) => (e.type as string) || "unknown"))];
        missingEvidenceTypes.push(...types.filter((t) => !t.includes("unknown")));
      }

      if (evidenceCount === 0) {
        blockers.push("missing_evidence");
        missingEvidenceTypes.push("all_types");
      }
    } catch {
      // Silently continue
    }

    // Check for pending change orders
    try {
      pendingChangeOrderCount = await this.prisma.changeOrderCandidate.count({
        where: { tenantId, projectId: (await this.prisma.milestone.findUnique({
          where: { id: milestoneId }, select: { projectId: true },
        }))?.projectId },
        filter: { status: { in: ["predicted", "submitted"] } },
      }).catch(() => 0);

      if (pendingChangeOrderCount > 0) {
        blockers.push("pending_change_order");
      }
    } catch {
      // Continue
    }

    // Check for critical operational signals
    try {
      const signals = await this.prisma.operationalSignal.findMany({
        where: { tenantId, severity: "critical", status: "open" },
        select: { type: true },
        take: 5,
      });

      signals.forEach((s) => criticalOperationalSignals.push((s.type as string) || "unknown_signal"));

      if (signals.length > 0) {
        blockers.push("critical_operational_signal");
      }
    } catch {
      // Continue
    }

    // Determine best next action
    let nextBestAction = "Review and reupload rejected evidence";
    if (rejectedEvidenceCount > 0) {
      nextBestAction = `Reupload ${rejectedEvidenceCount} rejected evidence items`;
    } else if (criticalOperationalSignals.length > 0) {
      nextBestAction = `Resolve critical signal: ${criticalOperationalSignals[0]}`;
    } else if (pendingChangeOrderCount > 0) {
      nextBestAction = "Review and apply pending change orders";
    } else {
      nextBestAction = "Request additional evidence or clarification";
    }

    // Build audit reason
    let auditReason = `Milestone "${milestoneTitle}" blocked due to: `;
    if (blockers.length === 0) {
      auditReason += "unknown reason (check manually)";
    } else {
      auditReason += blockers.join(", ");
    }

    return {
      milestoneId,
      releaseStatus: "blocked",
      canRelease: false,
      blockers: blockers.length > 0 ? blockers : ["unknown"],
      missingEvidenceTypes,
      rejectedEvidenceCount,
      needsReuploadEvidenceIds,
      pendingChangeOrderCount,
      criticalOperationalSignals,
      auditReason,
      nextBestAction,
    };
  }
}
