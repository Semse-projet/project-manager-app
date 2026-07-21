import { Injectable, Logger, Optional } from "@nestjs/common";
import Stripe from "stripe";
import type {
  CreateFundingIntentInput,
  CreatePayoutIntentInput,
  CreateRefundIntentInput,
  PaymentProviderPort,
} from "./payment-provider.port.js";
import type { FundingIntentRecord, PayoutIntentRecord, RefundIntentRecord } from "../payments.types.js";
import { StripeConnectService } from "../stripe-connect.service.js";

/**
 * Stripe provider with Stripe Connect support.
 * Requires STRIPE_SECRET_KEY (sk_test_... for sandbox).
 * createFundingIntent → Stripe PaymentIntent for escrow funding.
 * createPayoutIntent  → Stripe Transfer to per-contractor account with 0.75% platform fee (1.3.D).
 */
@Injectable()
export class StripePaymentProvider implements PaymentProviderPort {
  readonly key = "stripe" as const;

  private readonly logger = new Logger(StripePaymentProvider.name);
  private readonly stripe: Stripe;

  constructor(@Optional() private readonly connectService?: StripeConnectService) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("StripePaymentProvider requires STRIPE_SECRET_KEY env var");
    }
    this.stripe = new Stripe(secretKey, { apiVersion: "2026-06-24.dahlia" });
  }

  async createFundingIntent(input: CreateFundingIntentInput): Promise<FundingIntentRecord> {
    const amountInCents = Math.round(input.money.amount * 100);

    const intent = await this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency: input.money.currency.toLowerCase(),
      payment_method_types: ["card"],
      metadata: {
        semse_tenant_id: input.tenantId,
        semse_project_id: input.projectId,
        semse_external_ref: input.externalRef,
        ...(input.metadata as Record<string, string> | undefined),
      },
      description: `SEMSE escrow funding — project ${input.projectId}`,
    });

    this.logger.log({ intentId: intent.id, projectId: input.projectId }, "Stripe PaymentIntent created");

    return {
      id: `fin_${intent.id}`,
      tenantId: input.tenantId,
      projectId: input.projectId,
      provider: this.key,
      methodType: input.methodType,
      money: input.money,
      status: stripeIntentStatus(intent.status),
      providerRef: intent.id,
      externalRef: input.externalRef,
      metadata: {
        clientSecret: intent.client_secret,
        ...(input.metadata ?? {}),
      },
      createdAt: new Date().toISOString(),
    };
  }

  async createPayoutIntent(input: CreatePayoutIntentInput): Promise<PayoutIntentRecord> {
    const amountInCents = Math.round(input.money.amount * 100);

    // A known recipient MUST pay out to their own active Connect account —
    // never silently fall back to the shared legacy account for a payout
    // that has a specific, identified destination. That fallback used to
    // apply whenever the recipient's Connect account wasn't active yet,
    // sending their money to the platform's shared account instead
    // (0.16 in docs/AUDIT_REMEDIATION_PLAN.md). The shared-account fallback
    // now only applies when there is genuinely no specific recipient at all.
    let stripeAccountId: string | undefined;
    let platformFeeCents = 0;

    if (input.recipientUserId) {
      const perAccountId = this.connectService
        ? await this.connectService.getStripeAccountId(input.recipientUserId)
        : null;
      if (!perAccountId) {
        throw new Error(
          `Cannot pay out to recipient '${input.recipientUserId}': no active Stripe Connect account. ` +
          `Refusing to fall back to the shared platform account.`
        );
      }
      stripeAccountId = perAccountId;
      // 1.3.D: Deduct platform fee from the transferred amount
      platformFeeCents = this.connectService!.platformFeeForPayout(input.money.amount);
    } else {
      stripeAccountId = process.env.STRIPE_CONNECT_ACCOUNT_ID?.trim();
    }

    let providerRef: string;
    let status: PayoutIntentRecord["status"];

    if (stripeAccountId) {
      const netCents = amountInCents - platformFeeCents;
      const transfer = await this.stripe.transfers.create({
        amount: netCents,
        currency: input.money.currency.toLowerCase(),
        destination: stripeAccountId,
        metadata: {
          semse_tenant_id: input.tenantId,
          semse_project_id: input.projectId,
          semse_milestone_id: input.milestoneId ?? "",
          semse_external_ref: input.externalRef,
          semse_platform_fee_usd: (platformFeeCents / 100).toFixed(2),
        },
        description: `SEMSE milestone payout — project ${input.projectId}`,
      });
      providerRef = transfer.id;
      status = "paid";
      this.logger.log(
        { transferId: transfer.id, projectId: input.projectId, feeCents: platformFeeCents },
        "Stripe Transfer with platform fee created",
      );
    } else {
      // Sandbox without connected account: simulate payout
      const intent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: input.money.currency.toLowerCase(),
        payment_method_types: ["card"],
        metadata: {
          semse_tenant_id: input.tenantId,
          semse_project_id: input.projectId,
          semse_milestone_id: input.milestoneId ?? "",
          semse_payout_mode: "sandbox_simulate",
        },
        description: `SEMSE milestone payout (sandbox) — project ${input.projectId}`,
      });
      providerRef = intent.id;
      status = "processing";
      this.logger.log({ intentId: intent.id, projectId: input.projectId }, "Stripe sandbox payout simulated");
    }

    return {
      id: `poi_${providerRef}`,
      tenantId: input.tenantId,
      projectId: input.projectId,
      milestoneId: input.milestoneId,
      provider: this.key,
      methodType: input.methodType,
      money: input.money,
      status,
      providerRef,
      externalRef: input.externalRef,
      metadata: { ...(input.metadata ?? {}), platformFeeCents },
      createdAt: new Date().toISOString(),
    };
  }

  async createRefundIntent(input: CreateRefundIntentInput): Promise<RefundIntentRecord> {
    if (!input.originalProviderRef) {
      throw new Error("Stripe refund requires an original PaymentIntent or Charge providerRef");
    }

    const amountInCents = Math.round(input.money.amount * 100);
    const params: Stripe.RefundCreateParams = {
      amount: amountInCents,
      metadata: {
        semse_tenant_id: input.tenantId,
        semse_project_id: input.projectId,
        semse_external_ref: input.externalRef,
        ...(input.metadata as Record<string, string> | undefined),
      },
      reason: "requested_by_customer",
    };

    if (input.originalProviderRef.startsWith("ch_")) {
      params.charge = input.originalProviderRef;
    } else {
      params.payment_intent = input.originalProviderRef;
    }

    const refund = await this.stripe.refunds.create(params);
    this.logger.log({ refundId: refund.id, projectId: input.projectId }, "Stripe refund created");

    return {
      id: `rei_${refund.id}`,
      tenantId: input.tenantId,
      projectId: input.projectId,
      provider: this.key,
      methodType: input.methodType,
      money: input.money,
      status: stripeRefundStatus(refund.status),
      providerRef: refund.id,
      externalRef: input.externalRef,
      originalProviderRef: input.originalProviderRef,
      metadata: { ...(input.metadata ?? {}) },
      createdAt: new Date().toISOString(),
    };
  }
}

function stripeIntentStatus(stripeStatus: string): FundingIntentRecord["status"] {
  switch (stripeStatus) {
    case "succeeded": return "captured";
    case "processing": return "pending";
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_action": return "authorized";
    case "canceled": return "cancelled";
    default: return "pending";
  }
}

function stripeRefundStatus(stripeStatus: string | null): RefundIntentRecord["status"] {
  switch (stripeStatus) {
    case "succeeded": return "succeeded";
    case "failed": return "failed";
    case "canceled": return "cancelled";
    case "pending": return "pending";
    default: return "pending";
  }
}
