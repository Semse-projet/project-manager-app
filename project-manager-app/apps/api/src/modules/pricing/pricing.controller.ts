import { Controller, Get, Post, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestId } from "../../common/request-id.js";
import { MaterialPricingService } from "./material-pricing.service.js";

@Controller("v1/pricing")
export class PricingController {
  constructor(private readonly pricing: MaterialPricingService) {}

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
}
