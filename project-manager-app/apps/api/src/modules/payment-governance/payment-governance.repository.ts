import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { EscrowStatus, PaymentTxnStatus, PaymentTxnType } from "@prisma/client";

export interface PaymentReleaseInput {
  escrowId: string;
  milestoneId: string;
  amount: number;
  reason: string;
  releasedBy: string;
  tenantId: string;
}

export interface PaymentBlockInput {
  escrowId: string;
  reason: string;
  blockedBy: string;
}

export interface PaymentLedgerEntry {
  id: string;
  escrowId: string;
  milestoneId: string | null;
  type: PaymentTxnType;
  amount: any;
  status: PaymentTxnStatus;
  reason?: string;
  createdAt: Date;
}

@Injectable()
export class PaymentGovernanceRepository {
  private readonly logger = new Logger(PaymentGovernanceRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async getEscrow(escrowId: string, tenantId: string) {
    return this.prisma.paymentEscrow.findFirst({
      where: { id: escrowId, project: { tenantId } },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        project: {
          select: {
            id: true,
            tenantId: true,
            assignedProOrgId: true,
            job: { select: { clientOrgId: true } },
          },
        },
      },
    });
  }

  async getMilestonePayments(milestoneId: string) {
    return this.prisma.paymentTxn.findMany({
      where: { milestoneId },
      orderBy: { createdAt: "desc" },
      include: {
        escrow: {
          select: { id: true, projectId: true, status: true },
        },
      },
    });
  }

  /**
   * Legacy bypass retired (D02 / #827). All real escrow release reservations
   * must pass through PaymentsRepository.releaseFunds(), whose transaction
   * checks the verified contract execution BEFORE creating a PaymentTxn.
   * Never revive this direct Prisma writer as a convenience API.
   *
   * Keep the method as a fail-closed compatibility shim until its consumers
   * and mock contracts are migrated to the canonical command.
   */
  async createPaymentTransaction(
    _input: PaymentReleaseInput,
  ): Promise<PaymentLedgerEntry> {
    throw new ServiceUnavailableException(
      "Legacy escrow ledger writes are disabled; use the verified release reservation command",
    );
  }

  /** Never promote an arbitrary legacy PaymentTxn to success outside provider reconciliation. */
  async updatePaymentTransactionStatus(
    _transactionId: string,
    _status: PaymentTxnStatus,
  ): Promise<never> {
    throw new ServiceUnavailableException(
      "Legacy transaction status updates are disabled; use provider reconciliation",
    );
  }

  async updateEscrowStatus(escrowId: string, status: EscrowStatus) {
    return this.prisma.paymentEscrow.update({
      where: { id: escrowId },
      data: { status },
    });
  }

  async getMilestoneEvidence(projectId: string, milestoneId: string) {
    return this.prisma.evidence.findMany({
      where: {
        projectId,
        milestoneId,
      },
      select: {
        id: true,
        kind: true,
        validationStatus: true,
        aiQualityScore: true,
      },
    });
  }

  async countPendingChangeOrders(projectId: string, milestoneId: string) {
    return this.prisma.changeOrderCandidate.count({
      where: {
        AND: [
          { OR: [{ buildOpsProjectId: projectId }, { milestoneId }] },
          { status: { in: ["predicted", "submitted", "changes_requested"] } },
        ],
      },
    });
  }

  async getContractorProfile(contractorId: string) {
    // Returns vendor profile if available, null otherwise
    return this.prisma.vendor.findUnique({
      where: { id: contractorId },
      select: {
        id: true,
        name: true,
      },
    }).catch(() => null);
  }

  async getProjectMilestones(projectId: string) {
    return this.prisma.milestone.findMany({
      where: { projectId },
      select: {
        id: true,
        title: true,
        amount: true,
        paymentReadiness: true,
        status: true,
      },
      orderBy: { sequence: "asc" },
    });
  }

  async logPaymentDecision(
    escrowId: string,
    milestoneId: string,
    decision: "released" | "blocked",
    reason: string,
    decidedBy: string,
  ) {
    try {
      // Log to operational signals or events table if available
      this.logger.log(
        `Payment ${decision}: escrow=${escrowId}, milestone=${milestoneId}, reason=${reason}, by=${decidedBy}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to log payment decision: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
