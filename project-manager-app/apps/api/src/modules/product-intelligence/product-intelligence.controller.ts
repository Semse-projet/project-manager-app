import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  PayloadTooLargeException,
  Post,
  Req,
} from "@nestjs/common";
import { PRODUCT_EVENT_BATCH_MAX, productEventBatchSchema } from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { Public } from "../../common/public.decorator.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { ProductIntelligenceService } from "./product-intelligence.service.js";

/**
 * Kill switches (defaults OFF en producción hasta cerrar PI-05):
 *  - PRODUCT_INTELLIGENCE_ENABLED !== "true" → todo el módulo responde 403.
 *  - PI_INGEST_ENABLED === "false"          → solo la ingesta responde 403.
 */
function productIntelligenceEnabled(env = process.env): boolean {
  return env.PRODUCT_INTELLIGENCE_ENABLED === "true";
}

function ingestEnabled(env = process.env): boolean {
  return productIntelligenceEnabled(env) && env.PI_INGEST_ENABLED !== "false";
}

@Controller("v1/product-intelligence")
export class ProductIntelligenceController {
  constructor(private readonly service: ProductIntelligenceService) {}

  // Público: telemetría anónima con consentimiento. El schema Zod aplica la
  // allowlist de props y las reglas de consentimiento; el rate limit lo pone
  // el ThrottlerGuard global.
  @Post("ingest")
  @Public()
  @HttpCode(200)
  async ingest(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown,
    @Headers("x-tenant-id") tenantIdHeader?: string,
  ) {
    if (!ingestEnabled()) {
      throw new ForbiddenException("Product Intelligence ingest is disabled");
    }

    const eventCount = Array.isArray((body as { events?: unknown[] })?.events)
      ? (body as { events: unknown[] }).events.length
      : 0;
    if (eventCount > PRODUCT_EVENT_BATCH_MAX) {
      throw new PayloadTooLargeException(`batch supera ${PRODUCT_EVENT_BATCH_MAX} eventos`);
    }

    const parsed = productEventBatchSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new BadRequestException(
        `batch inválido: ${issue?.path?.join(".") ?? "?"} — ${issue?.message ?? "?"}`,
      );
    }

    const tenantId = tenantIdHeader?.trim() || "tenant_default";
    const result = await this.service.ingest(tenantId, parsed.data);
    return ok(resolveRequestId(req.headers ?? {}), result);
  }

  // PI-03.2 — invocado por el worker (patrón curator: timer → endpoint API).
  @Post("retention/run")
  @RequirePermissions("ops:dashboard:write")
  @HttpCode(200)
  async runRetention(@Req() req: { headers?: Record<string, unknown> }) {
    if (!productIntelligenceEnabled()) {
      throw new ForbiddenException("Product Intelligence is disabled");
    }
    const result = await this.service.runRetention();
    return ok(resolveRequestId(req.headers ?? {}), result);
  }
}
