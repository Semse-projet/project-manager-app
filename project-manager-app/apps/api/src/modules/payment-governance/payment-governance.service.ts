import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { PaymentGovernanceRepository, type PaymentReleaseInput } from "./payment-governance.repository.js";
import { PaymentGovernanceDiagnosticsService } from "./diagnostics.service.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";

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
  ): Promise<PaymentReleaseResult> {
    try {
      const escrow = await this.repository.getEscrow(input.escrowId);
      if (!escrow) {
        throw new NotFoundException(
          `Escrow ${input.escrowId} not found`,
        );
      }

      // Check release conditions
      const blockers = await this.checkReleaseBlockers(
        input.escrowId,
        input.milestoneId,
      );

      if (blockers.length > 0) {
        return {
          success: false,
          escrowId: input.escrowId,
          milestoneId: input.milestoneId,
          message: "Payment release blocked",
          blockers,
        };
      }

      // Calculate payment score
      const score = await this.calculatePaymentScore(
        input.escrowId,
        input.milestoneId,
      );

      // If score is below threshold (0.6), require additional approval
      if (score.overall < 0.6 && score.riskLevel === "high") {
        return {
          success: false,
          escrowId: input.escrowId,
          milestoneId: input.milestoneId,
          message: "Payment score below threshold (high risk)",
          blockers: ["high_risk_score"],
        };
      }

      // Create payment transaction
      const transaction = await this.repository.createPaymentTransaction(
        input,
      );

      // Log decision
      await this.repository.logPaymentDecision(
        input.escrowId,
        input.milestoneId,
        "released",
        input.reason,
        input.releasedBy,
      );

      // Emit SSE event if available
      if (this.sseBus) {
        const projectId = escrow.projectId;
        this.sseBus.emit("payment", "released", {
          projectId,
          escrowId: input.escrowId,
          milestoneId: input.milestoneId,
          transactionId: transaction.id,
          amount: input.amount,
          timestamp: new Date().toISOString(),
        });
      }

      return {
        success: true,
        transactionId: transaction.id,
        escrowId: input.escrowId,
        milestoneId: input.milestoneId,
        message: "Payment released successfully",
      };
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
  ): Promise<PaymentBlockResult> {
    try {
      const escrow = await this.repository.getEscrow(escrowId);
      if (!escrow) {
        throw new NotFoundException(`Escrow ${escrowId} not found`);
      }

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
  ) {
    return this.repository.getEscrow(escrowId);
  }

  async calculatePaymentScore(
    escrowId: string,
    milestoneId: string,
  ): Promise<PaymentScore> {
    let evidenceQuality = 0.5;
    let contractorVerification = 0.5;
    let operationalReadiness = 0.5;

    try {
      const escrow = await this.repository.getEscrow(escrowId);
      if (!escrow) {
        return {
          overall: 0.3,
          evidenceQuality: 0.2,
          contractorVerification: 0.2,
          operationalReadiness: 0.2,
          riskLevel: "high",
        };
      }

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
  ): Promise<string[]> {
    const blockers: string[] = [];

    try {
      const escrow = await this.repository.getEscrow(escrowId);
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
