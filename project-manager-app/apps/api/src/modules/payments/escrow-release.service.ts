import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { PaymentGovernanceService } from "./payment-governance.service.js";
import { PaymentsRepository } from "./payments.repository.js";
import { StripeConnectService } from "./stripe-connect.service.js";
import type { NotificationsService } from "../notifications/notifications.service.js";

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
    private readonly paymentsRepository: PaymentsRepository,
    @Optional() private readonly notifications?: NotificationsService,
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
      // Reserve first (atomic PENDING row, same pattern as PaymentsService's
      // manual release() flow), transfer second, finalize third. Previously
      // the Stripe transfer happened first and the DB write came after —
      // any failure in that write (or in the fire-and-forget caller at
      // MilestonesService.approve(), which discards this method's result
      // entirely) meant real money moved with no record of it anywhere
      // (0.15 in docs/AUDIT_REMEDIATION_PLAN.md).
      const reservationRef = `pending_autorelease_${milestoneId}_${Date.now()}`;
      const reservation = await this.paymentsRepository.releaseFunds({
        escrowId: milestone.project.escrow.id,
        milestoneId,
        amount: amountUsd,
        providerRef: reservationRef,
      });

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
      } catch (err) {
        this.logger.error(`[EscrowRelease] Transfer failed for ${milestoneId}: ${(err as Error).message}`);
        try {
          await this.paymentsRepository.finalizeRelease({
            transactionId: reservation.id,
            milestoneId,
            status: "FAILED",
          });
        } catch (finalizeErr) {
          this.logger.error(`[EscrowRelease] Also failed to record FAILED status for ${milestoneId}: ${(finalizeErr as Error).message}`);
        }
        return { milestoneId, released: false, blockers: [(err as Error).message], governanceResult: gov };
      }

      // Transfer succeeded — finalize now. Marking the milestone PAID lives
      // inside finalizeRelease(), so a second auto-release attempt is still
      // blocked by the same "already released" guard the manual release
      // path relies on (computePaymentReadiness treats status === "PAID"
      // as released).
      try {
        await this.paymentsRepository.finalizeRelease({
          transactionId: reservation.id,
          milestoneId,
          status: "SUCCEEDED",
          providerRef: transferId,
        });
      } catch (finalizeErr) {
        // The transfer DID happen — never swallow this. Surface it as
        // released with a blocker note instead of returning released:false,
        // so ops can see the reconciliation gap rather than it vanishing
        // into MilestonesService.approve()'s fire-and-forget .catch().
        this.logger.error(
          `[EscrowRelease] CRITICAL: Stripe transfer ${transferId} for milestone ${milestoneId} succeeded but ` +
          `recording it failed — manual reconciliation required: ${(finalizeErr as Error).message}`
        );
        return {
          milestoneId, released: true, transferId, netAmountUsd, platformFeeCents,
          blockers: [`Transfer succeeded but the DB record failed — manual reconciliation required: ${(finalizeErr as Error).message}`],
          governanceResult: gov,
        };
      }

      this.logger.log(`[EscrowRelease] Released $${netAmountUsd} for milestone ${milestoneId} → transfer ${transferId}`);

      void this.notifications?.handleEvent({
        tenantId,
        eventType: "payment.released",
        payload: {
          proUserId: recipientId,
          milestoneId,
          projectId: milestone.project?.id ?? "",
          amount: netAmountUsd,
          currency,
        },
      }).catch(() => undefined);
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
