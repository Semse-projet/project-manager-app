import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { PaymentGovernanceRepository, type PaymentReleaseInput } from "./payment-governance.repository.js";
import { PaymentGovernanceDiagnosticsService } from "./diagnostics.service.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";
import { assertMilestoneReadable, type MilestoneActor, type MilestoneOwnership } from "../milestones/milestones.policy.js";

export type EscrowActor = MilestoneActor;

type EscrowWithOwnership = {
  project: { assignedProOrgId: string; job: { clientOrgId: string } | null } | null;
};

// The escrow's own project is the resource an actor needs access to — an
// org is authorized only if it is the client org or the assigned pro org of
// that project. Same rule `milestones.policy.ts` already enforces for
// milestones; escrows previously had no equivalent check at all (only
// tenantId scoping — see payment-governance.repository.ts#getEscrow), which
// let any actor with a finance:* permission in one org of a tenant act on
// another org's escrow within the same tenant. This is resource-derived
// authorization per ADR-040: never based on a session-level "active org".
function assertEscrowReadable(actor: EscrowActor, escrow: EscrowWithOwnership): void {
  const ownership: MilestoneOwnership = {
    clientOrgId: escrow.project?.job?.clientOrgId ?? "",
    assignedProOrgId: escrow.project?.assignedProOrgId ?? "",
  };
  assertMilestoneReadable(actor, ownership);
}

export interface PaymentReleaseResult {
  success: boolean;
  transactionId?: string;
  escrowId: string;
  milestoneId: string;
  message: string;
  blockers?: string[];
}

export interface PaymentBlockResult {
  success: boolean;
  escrowId: string;
  message: string;
  reason: string;
}

export interface PaymentScore {
  overall: number;
  evidenceQuality: number;
  contractorVerification: number;
  operationalReadiness: number;
  riskLevel: "low" | "medium" | "high";
}

@Injectable()
export class PaymentGovernanceService {
  private readonly logger = new Logger(PaymentGovernanceService.name);

  constructor(
    private readonly repository: PaymentGovernanceRepository,
    private readonly diagnostics: PaymentGovernanceDiagnosticsService,
    private readonly sseBus?: SseEventBusService,
  ) {}

  async releasePayment(
    input: PaymentReleaseInput,
    actor: EscrowActor,
  ): Promise<PaymentReleaseResult> {
    try {
      const escrow = await this.repository.getEscrow(input.escrowId, input.tenantId);
      if (!escrow) {
        throw new NotFoundException(
          `Escrow ${input.escrowId} not found`,
        );
      }
      assertEscrowReadable(actor, escrow);

      // D02 mitigation (2026-09-14) — this method used to create a payment
      // transaction row, log a decision and report success WITHOUT ever
      // calling Stripe/EscrowReleaseService, the only path that actually
      // moves money. An admin using the "Liberar escrow" button in
      // admin/finance was told funds were released when they were not. The
      // real fix needs a milestone-resolution design (the caller only sends
      // escrowId+amount, not milestoneId, and a project can have several
      // milestones) — tracked in SEMSE_EXECUTION_LEDGER.md's Blockers and
      // tests/unit/payment-release-canonical-path.test.mjs. Until that
      // design lands, fail loudly here instead of fabricating success:
      // "unknown is not safe" applies to a fabricated success outcome the
      // same as to a fabricated value.
      throw new ServiceUnavailableException(
        "Manual payment release via this endpoint is temporarily disabled — it does not move real funds. See SEMSE_EXECUTION_LEDGER.md (D02 blocker) for the pending fix.",
      );
    } catch (error) {
      this.logger.error(
        `Release payment failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async blockPayment(
    escrowId: string,
    reason: string,
    blockedBy: string,
    tenantId: string,
    actor: EscrowActor,
  ): Promise<PaymentBlockResult> {
    try {
      const escrow = await this.repository.getEscrow(escrowId, tenantId);
      if (!escrow) {
        throw new NotFoundException(`Escrow ${escrowId} not found`);
      }
      assertEscrowReadable(actor, escrow);

      // Update escrow status to PENDING_SETTLEMENT (blocked state)
      await this.repository.updateEscrowStatus(escrowId, "PENDING_SETTLEMENT");

      // Log decision
      await this.repository.logPaymentDecision(
        escrowId,
        "",
        "blocked",
        reason,
        blockedBy,
      );

      // Emit SSE event
      if (this.sseBus) {
        this.sseBus.emit("payment", "blocked", {
          escrowId,
          reason,
          timestamp: new Date().toISOString(),
        });
      }

      return {
        success: true,
        escrowId,
        message: "Payment blocked successfully",
        reason,
      };
    } catch (error) {
      this.logger.error(
        `Block payment failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async getPaymentHistory(
    escrowId: string,
    tenantId: string,
    actor: EscrowActor,
  ) {
    const escrow = await this.repository.getEscrow(escrowId, tenantId);
    if (!escrow) {
      return null;
    }
    assertEscrowReadable(actor, escrow);
    return escrow;
  }

  async calculatePaymentScore(
    escrowId: string,
    milestoneId: string,
    tenantId: string,
    actor: EscrowActor,
  ): Promise<PaymentScore> {
    let evidenceQuality = 0.5;
    let contractorVerification = 0.5;
    let operationalReadiness = 0.5;

    // Fetched and authorized outside the try/catch below on purpose: that
    // catch-all is for calculation failures and must not swallow a
    // ForbiddenException into a fabricated low-confidence score — an
    // unauthorized caller must get denied, not a plausible-looking number.
    const escrow = await this.repository.getEscrow(escrowId, tenantId);
    if (!escrow) {
      return {
        overall: 0.3,
        evidenceQuality: 0.2,
        contractorVerification: 0.2,
        operationalReadiness: 0.2,
        riskLevel: "high",
      };
    }
    assertEscrowReadable(actor, escrow);

    try {
      // Check evidence quality
      const evidence = await this.repository.getMilestoneEvidence(
        escrow.projectId,
        milestoneId,
      );
      evidenceQuality = this.scoreEvidence(evidence);

      // Check contractor verification (default to medium)
      contractorVerification = 0.65;

      // Check operational readiness
      const pendingChanges = await this.repository.countPendingChangeOrders(
        escrow.projectId,
        milestoneId,
      );
      operationalReadiness = pendingChanges === 0 ? 0.8 : 0.4;

      const overall = (
        evidenceQuality * 0.4 +
        contractorVerification * 0.3 +
        operationalReadiness * 0.3
      );

      const riskLevel: "low" | "medium" | "high" =
        overall >= 0.75 ? "low" : overall >= 0.6 ? "medium" : "high";

      return {
        overall,
        evidenceQuality,
        contractorVerification,
        operationalReadiness,
        riskLevel,
      };
    } catch (error) {
      this.logger.error(
        `Score calculation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        overall: 0.3,
        evidenceQuality,
        contractorVerification,
        operationalReadiness,
        riskLevel: "high",
      };
    }
  }

  private async checkReleaseBlockers(
    escrowId: string,
    milestoneId: string,
    tenantId: string,
  ): Promise<string[]> {
    const blockers: string[] = [];

    try {
      const escrow = await this.repository.getEscrow(escrowId, tenantId);
      if (!escrow) {
        blockers.push("escrow_not_found");
        return blockers;
      }

      if (escrow.status === "PENDING_SETTLEMENT") {
        blockers.push("escrow_blocked");
      }

      // Check for pending change orders
      const pendingChanges =
        await this.repository.countPendingChangeOrders(
          escrow.projectId,
          milestoneId,
        );
      if (pendingChanges > 0) {
        blockers.push("pending_change_orders");
      }

      // Check for rejected evidence
      const evidence = await this.repository.getMilestoneEvidence(
        escrow.projectId,
        milestoneId,
      );
      const hasRejected = evidence.some(
        (e) => e.validationStatus === "failed",
      );
      if (hasRejected) {
        blockers.push("rejected_evidence");
      }

      if (evidence.length === 0) {
        blockers.push("missing_evidence");
      }
    } catch (error) {
      this.logger.error(
        `Blocker check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      blockers.push("system_error");
    }

    return blockers;
  }

  private scoreEvidence(
    evidence: Array<{ validationStatus: string | null; aiQualityScore?: any }>,
  ): number {
    if (evidence.length === 0) return 0.2;

    const validCount = evidence.filter(
      (e) => e.validationStatus === "passed",
    ).length;
    const avgScore =
      evidence.reduce((sum, e) => {
        const score = e.aiQualityScore ? Number(e.aiQualityScore) : 0.5;
        return sum + score;
      }, 0) / evidence.length;

    return (validCount / evidence.length) * 0.5 + avgScore * 0.5;
  }

  async getDiagnostics(tenantId: string) {
    return this.diagnostics.getDiagnostics(tenantId);
  }
}
