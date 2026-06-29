import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { PaymentTxnType, PaymentTxnStatus } from "@prisma/client";

export interface PaymentReleaseInput {
  escrowId: string;
  milestoneId: string;
  amount: number;
  reason: string;
  releasedBy: string;
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

  async getEscrow(escrowId: string) {
    return this.prisma.paymentEscrow.findUnique({
      where: { id: escrowId },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        project: {
          select: { id: true, tenantId: true },
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

  async createPaymentTransaction(
    input: PaymentReleaseInput,
  ): Promise<PaymentLedgerEntry> {
    return this.prisma.paymentTxn.create({
      data: {
        escrowId: input.escrowId,
        milestoneId: input.milestoneId,
        type: "RELEASE",
        amount: input.amount,
        status: "PENDING",
        providerRef: `semse-release-${Date.now()}`,
      },
    });
  }

  async updatePaymentTransactionStatus(
    transactionId: string,
    status: PaymentTxnStatus,
  ) {
    return this.prisma.paymentTxn.update({
      where: { id: transactionId },
      data: { status },
    });
  }

  async updateEscrowStatus(escrowId: string, status: string) {
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
          { status: { in: ["predicted", "submitted"] } },
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
