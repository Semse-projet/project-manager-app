import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import Stripe from "stripe";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

const SEMSE_PLATFORM_FEE_RATE = 0.0075; // 0.75% platform fee on each payout

export type ConnectAccountView = {
  userId:           string;
  stripeAccountId:  string;
  status:           string;
  chargesEnabled:   boolean;
  payoutsEnabled:   boolean;
  onboardingUrl:    string | null;
  country:          string;
  currency:         string;
  updatedAt:        string;
};

export type OnboardingLinkResult = {
  stripeAccountId: string;
  onboardingUrl:   string;
  expiresAt:       string;
};

@Injectable()
export class StripeConnectService {
  private readonly logger = new Logger(StripeConnectService.name);
  private readonly stripe: Stripe | null;

  static readonly PLATFORM_FEE_RATE = SEMSE_PLATFORM_FEE_RATE;

  constructor(private readonly prisma: PrismaService) {
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    this.stripe = secretKey
      ? new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" })
      : null;
    if (!this.stripe) {
      this.logger.warn("[StripeConnect] STRIPE_SECRET_KEY not set — running in mock mode");
    }
  }

  // ── 1.3.A: Create or retrieve Stripe Custom Account ──────────────────────

  async getOrCreateAccount(userId: string, email: string): Promise<ConnectAccountView> {
    const existing = await this.prisma.stripeConnectAccount.findUnique({ where: { userId } });
    if (existing) {
      return this.toView(existing as Parameters<typeof this.toView>[0]);
    }

    let stripeAccountId: string;

    if (this.stripe) {
      const account = await this.stripe.accounts.create({
        type: "custom",
        country: "US",
        email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: { semse_user_id: userId },
      });
      stripeAccountId = account.id;
      this.logger.log(`[StripeConnect] Created account ${stripeAccountId} for user ${userId}`);
    } else {
      stripeAccountId = `acct_mock_${userId.replace(/[^a-z0-9]/gi, "").slice(0, 16)}`;
      this.logger.debug(`[StripeConnect] Mock account created: ${stripeAccountId}`);
    }

    const row = await this.prisma.stripeConnectAccount.create({
      data: { userId, stripeAccountId, status: "pending" },
    });
    return this.toView(row as Parameters<typeof this.toView>[0]);
  }

  // ── 1.3.A: Generate onboarding link ──────────────────────────────────────

  async createOnboardingLink(userId: string, returnUrl: string, refreshUrl: string): Promise<OnboardingLinkResult> {
    const row = await this.prisma.stripeConnectAccount.findUnique({ where: { userId } });
    if (!row) throw new NotFoundException(`No Stripe account found for user ${userId}`);

    let url: string;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    if (this.stripe) {
      const link = await this.stripe.accountLinks.create({
        account: row.stripeAccountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: "account_onboarding",
      });
      url = link.url;
    } else {
      url = `${returnUrl}?mock=true&account=${row.stripeAccountId}`;
      this.logger.debug(`[StripeConnect] Mock onboarding URL: ${url}`);
    }

    await this.prisma.stripeConnectAccount.update({
      where: { userId },
      data: { onboardingUrl: url },
    });

    return { stripeAccountId: row.stripeAccountId, onboardingUrl: url, expiresAt };
  }

  // ── 1.3.A: Sync account status from Stripe ───────────────────────────────

  async syncAccountStatus(userId: string): Promise<ConnectAccountView> {
    const row = await this.prisma.stripeConnectAccount.findUnique({ where: { userId } });
    if (!row) throw new NotFoundException(`No Stripe account found for user ${userId}`);

    let chargesEnabled = false;
    let payoutsEnabled = false;
    let newStatus = row.status;

    if (this.stripe) {
      const account = await this.stripe.accounts.retrieve(row.stripeAccountId);
      chargesEnabled = account.charges_enabled ?? false;
      payoutsEnabled = account.payouts_enabled ?? false;
      newStatus = chargesEnabled && payoutsEnabled ? "active"
        : account.details_submitted ? "restricted"
        : "pending";
    }

    const updated = await this.prisma.stripeConnectAccount.update({
      where: { userId },
      data: { chargesEnabled, payoutsEnabled, status: newStatus },
    });
    this.logger.log(`[StripeConnect] Synced ${row.stripeAccountId}: charges=${chargesEnabled} payouts=${payoutsEnabled}`);
    return this.toView(updated as Parameters<typeof this.toView>[0]);
  }

  // ── 1.3.D: Platform fee calculation ──────────────────────────────────────

  /** Returns the application fee amount in cents for a given payout amount. */
  platformFeeForPayout(payoutAmountUsd: number): number {
    return Math.round(payoutAmountUsd * SEMSE_PLATFORM_FEE_RATE * 100); // in cents
  }

  // ── 1.3.D: Transfer to connected account with platform fee ───────────────

  async transferToContractor(input: {
    userId:    string;
    amountUsd: number;
    currency:  string;
    metadata:  Record<string, string>;
  }): Promise<{ transferId: string; platformFeeCents: number; netAmountUsd: number }> {
    const row = await this.prisma.stripeConnectAccount.findUnique({ where: { userId: input.userId } });
    if (!row) throw new NotFoundException(`No Stripe account for user ${input.userId}`);

    const amountCents = Math.round(input.amountUsd * 100);
    const feeCents    = this.platformFeeForPayout(input.amountUsd);
    const netCents    = amountCents - feeCents;

    let transferId: string;

    if (this.stripe && row.stripeAccountId && !row.stripeAccountId.startsWith("acct_mock_")) {
      const transfer = await this.stripe.transfers.create({
        amount:      netCents,
        currency:    input.currency.toLowerCase(),
        destination: row.stripeAccountId,
        metadata:    { ...input.metadata, semse_platform_fee_usd: (feeCents / 100).toFixed(2) },
      });
      transferId = transfer.id;
      this.logger.log(`[StripeConnect] Transfer ${transferId} to ${row.stripeAccountId}: $${(netCents / 100).toFixed(2)} (fee $${(feeCents / 100).toFixed(2)})`);
    } else {
      transferId = `tr_mock_${Date.now()}`;
      this.logger.debug(`[StripeConnect] Mock transfer ${transferId}: $${(netCents / 100).toFixed(2)}`);
    }

    return {
      transferId,
      platformFeeCents: feeCents,
      netAmountUsd:     netCents / 100,
    };
  }

  // ── Lookup ────────────────────────────────────────────────────────────────

  async getAccount(userId: string): Promise<ConnectAccountView | null> {
    const row = await this.prisma.stripeConnectAccount.findUnique({ where: { userId } });
    return row ? this.toView(row as Parameters<typeof this.toView>[0]) : null;
  }

  async getStripeAccountId(userId: string): Promise<string | null> {
    const row = await this.prisma.stripeConnectAccount.findUnique({
      where: { userId },
      select: { stripeAccountId: true, status: true },
    });
    return row?.status === "active" ? row.stripeAccountId : null;
  }

  private toView(row: {
    userId: string; stripeAccountId: string; status: string;
    chargesEnabled: boolean; payoutsEnabled: boolean; onboardingUrl: string | null;
    country: string; currency: string; updatedAt: Date;
  }): ConnectAccountView {
    return {
      userId:          row.userId,
      stripeAccountId: row.stripeAccountId,
      status:          row.status,
      chargesEnabled:  row.chargesEnabled,
      payoutsEnabled:  row.payoutsEnabled,
      onboardingUrl:   row.onboardingUrl,
      country:         row.country,
      currency:        row.currency,
      updatedAt:       row.updatedAt.toISOString(),
    };
  }
}
