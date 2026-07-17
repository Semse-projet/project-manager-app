import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { MilestonesRepository } from "../milestones/milestones.repository.js";

export type ReleaseStatus = "ready" | "blocked" | "needs_review" | "released" | "disputed";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export type PaymentGovernanceResult = {
  milestoneId:       string;
  projectId:         string | null;
  milestoneStatus:   string;
  evidenceReadiness: string;
  paymentReadiness:  string;
  releaseStatus:     ReleaseStatus;
  canRelease:        boolean;
  blockers:          string[];
  requiredActions:   string[];
  riskLevel:         RiskLevel;
  evidenceSummary: {
    total:     number;
    required:  number;
    approved:  number;
    missing:   number;
    rejected:  number;
    submitted: number;
  };
  changeOrderBlockers: number;
  openSignals:     number;
  criticalSignals: number;
  disputeRisk:     boolean;
  nextBestAction:  string;
  auditReason:     string;
  governedAt:      string;
};

@Injectable()
export class PaymentGovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly milestonesRepo: MilestonesRepository,
  ) {}

  async evaluate(milestoneId: string, tenantId: string): Promise<PaymentGovernanceResult> {
    // 1. Core readiness from existing logic (evidence + dispute + approval)
    const readiness = await this.milestonesRepo.computePaymentReadiness(milestoneId, tenantId);
    const ms = readiness.milestone;

    // 2. Load extended milestone data
    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, project: { tenantId } },
      include: {
        project: { select: { id: true, jobId: true } },
        evidenceItems: { select: { status: true, required: true, label: true } },
      },
    });

    const projectId = milestone?.project?.id ?? null;

    // 3. Evidence summary from items
    const allItems = milestone?.evidenceItems ?? [];
    const required  = allItems.filter((e) => e.required);
    const evidenceSummary = {
      total:     allItems.length,
      required:  required.length,
      approved:  required.filter((e) => e.status === "approved").length,
      // archived is treated as missing for governance — needs active replacement
      missing:   required.filter((e) => e.status === "missing" || e.status === "archived").length,
      rejected:  required.filter((e) => e.status === "rejected").length,
      submitted: required.filter((e) => e.status === "submitted").length,
      archived:  required.filter((e) => e.status === "archived").length,
    };

    // 4. Open change order candidates that could block payment
    const changeOrderBlockers = await this.prisma.changeOrderCandidate.count({
      where: {
        tenantId,
        milestoneId,
        status: { in: ["predicted", "submitted"] },
      },
    });

    // 5. Operational signals (critical/high on this milestone)
    const [openSignals, criticalSignals] = await Promise.all([
      this.prisma.operationalSignal.count({
        where: { tenantId, milestoneId, status: "open" },
      }),
      this.prisma.operationalSignal.count({
        where: { tenantId, milestoneId, status: "open", severity: { in: ["critical", "high"] } },
      }),
    ]);

    // 6. Assemble blockers from all sources
    const blockers = [...readiness.blockers];
    const requiredActions: string[] = [];

    if (changeOrderBlockers > 0) {
      blockers.push(`${changeOrderBlockers} change order candidate(s) pending — must be resolved before payment`);
      requiredActions.push("Review and approve or reject open change order candidates");
    }

    if (criticalSignals > 0) {
      blockers.push(`${criticalSignals} critical/high signal(s) open in Mission Control`);
      requiredActions.push("Resolve critical signals in Mission Control before releasing payment");
    }

    // 7. Determine releaseStatus and canRelease
    const coreStatus = readiness.status;
    let releaseStatus: ReleaseStatus = "blocked";
    let canRelease = false;

    if (coreStatus === "released") {
      releaseStatus = "released";
      canRelease = false; // already released
    } else if (coreStatus === "disputed") {
      releaseStatus = "disputed";
      canRelease = false;
    } else if (blockers.length === 0 && coreStatus === "ready_to_release") {
      releaseStatus = "ready";
      canRelease = true;
    } else if (changeOrderBlockers > 0 || criticalSignals > 0) {
      // Has additional blockers beyond evidence — needs human review
      releaseStatus = "needs_review";
      canRelease = false;
    } else {
      releaseStatus = "blocked";
      canRelease = false;
    }

    // 8. Risk level
    let riskLevel: RiskLevel = "low";
    if (readiness.status === "disputed" || criticalSignals > 0) riskLevel = "critical";
    else if (evidenceSummary.rejected > 0 || changeOrderBlockers > 0) riskLevel = "high";
    else if (evidenceSummary.missing > 0 || openSignals > 0) riskLevel = "medium";

    // 9. Next best action
    let nextBestAction = readiness.nextAction;
    if (changeOrderBlockers > 0) nextBestAction = `Resolve ${changeOrderBlockers} pending change order(s) before releasing payment`;
    else if (criticalSignals > 0) nextBestAction = "Resolve critical Mission Control signals first";
    else if (canRelease) nextBestAction = "All conditions met — payment can be released";

    // 10. Audit reason
    const auditReason = canRelease
      ? `Evidence complete (${evidenceSummary.approved}/${evidenceSummary.required}), milestone approved, no blockers`
      : `Blocked: ${blockers.slice(0, 2).join("; ")}${blockers.length > 2 ? ` (+${blockers.length - 2} more)` : ""}`;

    return {
      milestoneId,
      projectId,
      milestoneStatus:   ms?.status ?? milestone?.status ?? "unknown",
      evidenceReadiness: ms?.evidenceReadiness ?? milestone?.evidenceReadiness ?? "unknown",
      paymentReadiness:  ms?.paymentReadiness ?? milestone?.paymentReadiness ?? "not_ready",
      releaseStatus,
      canRelease,
      blockers,
      requiredActions,
      riskLevel,
      evidenceSummary,
      changeOrderBlockers,
      openSignals,
      criticalSignals,
      disputeRisk: readiness.status === "disputed",
      nextBestAction,
      auditReason,
      governedAt: new Date().toISOString(),
    };
  }
}
