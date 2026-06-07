import { Body, Controller, Delete, Get, Post, Put, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestId } from "../../common/request-id.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { MaterialPricingService } from "./material-pricing.service.js";
import { ContractorRateService, type UpsertContractorRateInput } from "./contractor-rate.service.js";

@Controller("v1/pricing")
export class PricingController {
  constructor(
    private readonly pricing: MaterialPricingService,
    private readonly contractorRate: ContractorRateService,
  ) {}

  /** Current material prices from cache */
  @Get("materials")
  @RequirePermissions("projects:read")
  async getMaterialPrices(@Req() req: { headers?: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const prices = await this.pricing.getCurrentPrices();
    return ok(rid, { prices, source: "BLS_PPI_CACHE" });
  }

  /** Pricing cache status */
  @Get("status")
  @RequirePermissions("ops:dashboard:read")
  async getPricingStatus(@Req() req: { headers?: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const status = await this.pricing.getPricingStatus();
    return ok(rid, status);
  }

  /** Manually trigger a price refresh (admin only) */
  @Post("refresh")
  @RequirePermissions("ops:dashboard:read")
  async refreshPrices(@Req() req: { headers?: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = await this.pricing.refreshPrices();
    return ok(rid, result);
  }

  /** Get current user's contractor rate override */
  @Get("labor-rates")
  @RequirePermissions("projects:read")
  async getMyRates(@Req() req: { headers?: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const override = await this.contractorRate.getOverride(ctx.userId);
    return ok(rid, {
      override,
      nationalBaselineHourlyRate: ContractorRateService.nationalBaselineHourlyRate,
      hasCustomRates: override !== null,
    });
  }

  /** Upsert current user's contractor rate override */
  @Put("labor-rates")
  @RequirePermissions("projects:read")
  async upsertMyRates(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: UpsertContractorRateInput,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const override = await this.contractorRate.upsertOverride(ctx.userId, {
      laborRatePerHr: Number(body.laborRatePerHr),
      materialMarkup: Number(body.materialMarkup),
      notes:          body.notes,
    });
    return ok(rid, { override, saved: true });
  }

  /** Delete current user's contractor rate override (revert to BLS data) */
  @Delete("labor-rates")
  @RequirePermissions("projects:read")
  async deleteMyRates(@Req() req: { headers?: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    await this.contractorRate.deleteOverride(ctx.userId);
    return ok(rid, { deleted: true, revertedToBls: true });
  }
}
