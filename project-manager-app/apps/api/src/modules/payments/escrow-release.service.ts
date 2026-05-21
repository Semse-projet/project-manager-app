import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { PaymentGovernanceService } from "./payment-governance.service.js";
import { StripeConnectService } from "./stripe-connect.service.js";

export type EscrowReleaseResult = {
  milestoneId:    string;
  released:       boolean;
  transferId?:    string;
  netAmountUsd?:  number;
  platformFeeCents?: number;
  blockers:       string[];
  governanceResult: Awaited<ReturnType<PaymentGovernanceService["evaluate"]>>;
};

/** 1.3.B + 1.3.C — Automatic escrow release when a milestone is approved in the FSM.
 *  Checks governance, then issues the Stripe transfer with the platform fee deducted. */
@Injectable()
export class EscrowReleaseService {
  private readonly logger = new Logger(EscrowReleaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly governance: PaymentGovernanceService,
    private readonly connect: StripeConnectService,
  ) {}

  /** Called from MilestonesService.approve() via @Optional injection. */
  async tryAutoRelease(milestoneId: string, tenantId: string): Promise<EscrowReleaseResult> {
    const gov = await this.governance.evaluate(milestoneId, tenantId);

    if (!gov.canRelease) {
      this.logger.debug(`[EscrowRelease] ${milestoneId} blocked — ${gov.blockers.join(", ")}`);
      return { milestoneId, released: false, blockers: gov.blockers, governanceResult: gov };
    }

    // Load milestone amount + linked project/escrow
    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId },
      select: {
        id: true,
        amount: true,
        project: {
          select: {
            id: true,
            escrow: { select: { id: true, providerRef: true, currency: true } },
            job: { select: { reservations: { where: { status: "ACCEPTED" as const }, select: { professionalId: true } } } },
          },
        },
      },
    });

    if (!milestone?.project?.escrow) {
      this.logger.warn(`[EscrowRelease] ${milestoneId} has no linked escrow — skipping`);
      return { milestoneId, released: false, blockers: ["No escrow linked to project"], governanceResult: gov };
    }

    const amountUsd     = Number(milestone.amount);
    const currency      = milestone.project?.escrow.currency ?? "usd";
    const recipientId   = milestone.project?.job?.reservations?.[0]?.professionalId ?? null;

    // Perform Stripe transfer with platform fee (1.3.D applied by connect.transferToContractor)
    let transferId: string | undefined;
    let netAmountUsd: number | undefined;
    let platformFeeCents: number | undefined;

    if (recipientId) {
      try {
        const result = await this.connect.transferToContractor({
          userId:    recipientId,
          amountUsd,
          currency,
          metadata: {
            semse_milestone_id: milestoneId,
            semse_project_id:   milestone.project?.id,
            semse_escrow_id:    milestone.project?.escrow.id,
          },
        });
        transferId      = result.transferId;
        netAmountUsd    = result.netAmountUsd;
        platformFeeCents = result.platformFeeCents;

        // Record PaymentTxn for the release
        await this.prisma.paymentTxn.create({
          data: {
            escrowId:   milestone.project?.escrow.id,
            milestoneId,
            type:       "RELEASE",
            amount:     netAmountUsd,
            providerRef: transferId,
            status:     "SUCCEEDED",
          },
        });

        this.logger.log(`[EscrowRelease] Released $${netAmountUsd} for milestone ${milestoneId} → transfer ${transferId}`);
      } catch (err) {
        this.logger.error(`[EscrowRelease] Transfer failed for ${milestoneId}: ${(err as Error).message}`);
        return { milestoneId, released: false, blockers: [(err as Error).message], governanceResult: gov };
      }
    } else {
      this.logger.warn(`[EscrowRelease] No accepted worker for project — release skipped, governance passed`);
    }

    return {
      milestoneId,
      released: true,
      transferId,
      netAmountUsd,
      platformFeeCents,
      blockers: [],
      governanceResult: gov,
    };
  }
}
