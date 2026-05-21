import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestId } from "../../common/request-id.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { StripeConnectService } from "./stripe-connect.service.js";

@Controller("v1/payments/connect")
export class StripeConnectController {
  constructor(private readonly connect: StripeConnectService) {}

  /** Get current user's Stripe Connect account status */
  @Get("account")
  @RequirePermissions("projects:read")
  async getMyAccount(@Req() req: { headers?: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const account = await this.connect.getAccount(ctx.userId);
    return ok(rid, { account, platformFeeRate: StripeConnectService.PLATFORM_FEE_RATE });
  }

  /** Create or retrieve Stripe Connect account for current user */
  @Post("account")
  @RequirePermissions("projects:read")
  async createMyAccount(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: { email?: string },
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const email = body.email ?? `${ctx.userId}@semse.io`;
    const account = await this.connect.getOrCreateAccount(ctx.userId, email);
    return ok(rid, { account, created: true });
  }

  /** Generate or refresh Stripe onboarding link */
  @Post("onboarding-link")
  @RequirePermissions("projects:read")
  async createOnboardingLink(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: { returnUrl?: string; refreshUrl?: string },
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.semse.io";
    const result = await this.connect.createOnboardingLink(
      ctx.userId,
      body.returnUrl ?? `${baseUrl}/worker/payments?onboarding=complete`,
      body.refreshUrl ?? `${baseUrl}/worker/payments?onboarding=refresh`,
    );
    return ok(rid, result);
  }

  /** Sync account status from Stripe */
  @Post("sync")
  @RequirePermissions("projects:read")
  async syncMyAccount(@Req() req: { headers?: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const account = await this.connect.syncAccountStatus(ctx.userId);
    return ok(rid, { account, synced: true });
  }
}
