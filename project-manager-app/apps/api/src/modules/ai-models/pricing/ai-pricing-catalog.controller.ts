import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ok } from "../../../common/api-response.js";
import { RequirePermissions } from "../../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../../common/request-context.js";
import { AiPricingCatalogService } from "./ai-pricing-catalog.service.js";

/**
 * C39 — catálogo global de precios de modelos de IA. Solo OPS_ADMIN (permiso de
 * operaciones + comprobación de rol en el servicio). Nada cobra ni factura: solo
 * documenta lo que la plataforma paga al proveedor (fuente oficial, auditable).
 */
@Controller("v1/admin/ai-pricing")
export class AiPricingCatalogController {
  constructor(private readonly catalog: AiPricingCatalogService) {}

  @Get("prices")
  @RequirePermissions("ops:dashboard:read")
  async list(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("provider") provider?: string,
    @Query("modelSlug") modelSlug?: string,
    @Query("providerModelName") providerModelName?: string,
  ) {
    const actor = resolveRequestContext(req);
    const prices = await this.catalog.list({
      ...(provider ? { provider } : {}),
      ...(modelSlug ? { modelSlug } : {}),
      ...(providerModelName ? { providerModelName } : {}),
    });
    return ok(actor.tenantId, { prices });
  }

  @Post("prices")
  @RequirePermissions("ops:dashboard:write")
  async create(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const price = await this.catalog.createPrice(actor, body);
    return ok(actor.tenantId, { price });
  }
}
