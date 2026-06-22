import { BadGatewayException, Injectable, Logger, NotFoundException } from "@nestjs/common";
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

type StripeConnectRow = {
  userId: string;
  stripeAccountId: string;
  status: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingUrl: string | null;
  country: string;
  currency: string;
  updatedAt: Date;
};

@Injectable()
export class StripeConnectService {
  private readonly logger = new Logger(StripeConnectService.name);
  private readonly stripe: Stripe | null;
  private readonly prisma: PrismaService;

  static readonly PLATFORM_FEE_RATE = SEMSE_PLATFORM_FEE_RATE;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    this.stripe = secretKey
      ? new Stripe(secretKey, { apiVersion: "2026-05-27.dahlia" })
      : null;
    if (!this.stripe) {
      this.logger.warn("[StripeConnect] STRIPE_SECRET_KEY not set — running in mock mode");
    }
  }

  // ── 1.3.A: Create or retrieve Stripe Custom Account ──────────────────────

  async getOrCreateAccount(userId: string, email: string): Promise<ConnectAccountView> {
    const existing = await this.prisma.stripeConnectAccount.findUnique({ where: { userId } });
    if (existing) {
      return this.toView(await this.ensureUsableAccount(existing as StripeConnectRow, email));
    }

    const stripeAccountId = await this.createProviderAccount(userId, email);

    const row = await this.prisma.stripeConnectAccount.create({
      data: { userId, stripeAccountId, status: "pending" },
    });
    return this.toView(row as StripeConnectRow);
  }

  // ── 1.3.A: Generate onboarding link ──────────────────────────────────────

  async createOnboardingLink(userId: string, returnUrl: string, refreshUrl: string): Promise<OnboardingLinkResult> {
    const existing = await this.prisma.stripeConnectAccount.findUnique({ where: { userId } });
    const row = existing
      ? await this.ensureUsableAccount(existing as StripeConnectRow, `${userId}@semse.io`)
      : null;
    if (!row) throw new NotFoundException(`No Stripe account found for user ${userId}`);

    let url: string;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    if (this.stripe && this.isLiveStripeAccount(row.stripeAccountId)) {
      try {
        const link = await this.stripe.accountLinks.create({
          account: row.stripeAccountId,
          refresh_url: refreshUrl,
          return_url: returnUrl,
          type: "account_onboarding",
        });
        url = link.url;
      } catch (error) {
        this.logger.error(`[StripeConnect] Onboarding link failed for ${row.stripeAccountId}: ${this.errorMessage(error)}`);
        throw new BadGatewayException(`No pudimos crear el enlace de onboarding de Stripe. ${this.publicStripeDiagnostic(error)}`);
      }
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
    const existing = await this.prisma.stripeConnectAccount.findUnique({ where: { userId } });
    const row = existing
      ? await this.ensureUsableAccount(existing as StripeConnectRow, `${userId}@semse.io`)
      : null;
    if (!row) throw new NotFoundException(`No Stripe account found for user ${userId}`);

    let chargesEnabled = false;
    let payoutsEnabled = false;
    let newStatus = row.status;

    if (this.stripe && this.isLiveStripeAccount(row.stripeAccountId)) {
      try {
        const account = await this.stripe.accounts.retrieve(row.stripeAccountId);
        chargesEnabled = account.charges_enabled ?? false;
        payoutsEnabled = account.payouts_enabled ?? false;
        newStatus = chargesEnabled && payoutsEnabled ? "active"
          : account.details_submitted ? "restricted"
          : "pending";
      } catch (error) {
        this.logger.error(`[StripeConnect] Sync failed for ${row.stripeAccountId}: ${this.errorMessage(error)}`);
        throw new BadGatewayException(`No pudimos sincronizar la cuenta Stripe Connect. ${this.publicStripeDiagnostic(error)}`);
      }
    }

    const updated = await this.prisma.stripeConnectAccount.update({
      where: { userId },
      data: { chargesEnabled, payoutsEnabled, status: newStatus },
    });
    this.logger.log(`[StripeConnect] Synced ${row.stripeAccountId}: charges=${chargesEnabled} payouts=${payoutsEnabled}`);
    return this.toView(updated as StripeConnectRow);
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

  private async ensureUsableAccount(row: StripeConnectRow, email: string): Promise<StripeConnectRow> {
    if (!this.stripe || this.isLiveStripeAccount(row.stripeAccountId)) {
      return row;
    }

    const stripeAccountId = await this.createProviderAccount(row.userId, email);
    const updated = await this.prisma.stripeConnectAccount.update({
      where: { userId: row.userId },
      data: {
        stripeAccountId,
        status: "pending",
        chargesEnabled: false,
        payoutsEnabled: false,
        onboardingUrl: null,
      },
    });
    this.logger.log(`[StripeConnect] Upgraded mock account for user ${row.userId} to ${stripeAccountId}`);
    return updated as StripeConnectRow;
  }

  private async createProviderAccount(userId: string, email: string): Promise<string> {
    if (!this.stripe) {
      const stripeAccountId = `acct_mock_${userId.replace(/[^a-z0-9]/gi, "").slice(0, 16)}`;
      this.logger.debug(`[StripeConnect] Mock account created: ${stripeAccountId}`);
      return stripeAccountId;
    }

    try {
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
      this.logger.log(`[StripeConnect] Created account ${account.id} for user ${userId}`);
      return account.id;
    } catch (error) {
      this.logger.error(`[StripeConnect] Account creation failed for user ${userId}: ${this.errorMessage(error)}`);
      throw new BadGatewayException(`No pudimos crear la cuenta Stripe Connect. ${this.publicStripeDiagnostic(error)}`);
    }
  }

  private isLiveStripeAccount(stripeAccountId: string): boolean {
    return stripeAccountId.startsWith("acct_") && !stripeAccountId.startsWith("acct_mock_");
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private publicStripeDiagnostic(error: unknown): string {
    const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
    const rawMessage = this.errorMessage(error);
    const message = rawMessage.length > 220 ? `${rawMessage.slice(0, 220)}...` : rawMessage;
    const code = typeof record.code === "string" ? record.code : undefined;
    const type = typeof record.type === "string" ? record.type : undefined;
    const parts = [
      code ? `code=${code}` : null,
      type ? `type=${type}` : null,
      message ? `message=${message}` : null,
    ].filter(Boolean);
    return parts.length > 0
      ? `Stripe respondió: ${parts.join("; ")}`
      : "Revisa la configuración de Stripe Connect.";
  }

  private toView(row: StripeConnectRow): ConnectAccountView {
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
