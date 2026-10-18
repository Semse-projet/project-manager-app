import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { AuthenticatedAccess, RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { OffersService } from "./offers.service.js";

type Req_ = { headers?: Record<string, unknown> };

const idSchema = z.string().trim().min(1).max(64);
const createSchema = z.object({
  recipientUserId: idSchema,
  positionTitle: z.string().trim().min(2).max(120),
  classification: z.enum(["W2", "1099", "OTHER"]),
  startsAt: z.coerce.date().optional(),
  compensationNote: z.string().trim().max(500).optional(),
  expiresInDays: z.number().int().min(1).max(30).optional()
});
const listQuerySchema = z.object({
  status: z.enum(["SENT", "ACCEPTED", "DECLINED", "EXPIRED", "REVOKED"]).optional()
});
const confirmSchema = z.object({ legalConfirmed: z.literal(true) });
const endSchema = z.object({ reason: z.string().trim().min(1).max(500) });
const respondSchema = z.object({ decision: z.enum(["ACCEPT", "DECLINE"]) });

/** BO-05: gestión privada de ofertas y engagements de una Org. Spec: docs/specs/core/business-offers.spec.md */
@Controller("v1/organizations/:orgId")
export class OrgOffersController {
  constructor(private readonly offers: OffersService) {}

  @Post("offers")
  @RequirePermissions("org:offers:manage")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async create(@Req() req: Req_, @Param("orgId") orgId: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.offers.create(actor, parseWithSchema(idSchema, orgId), requestId, parseWithSchema(createSchema, body));
    return ok(requestId, data);
  }

  @Get("offers")
  @RequirePermissions("org:offers:manage")
  async list(@Req() req: Req_, @Param("orgId") orgId: string, @Query() query: unknown) {
    const actor = resolveRequestContext(req);
    const { status } = parseWithSchema(listQuerySchema, query ?? {});
    const data = await this.offers.list(actor, parseWithSchema(idSchema, orgId), status);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("offers/:offerId/revoke")
  @HttpCode(200)
  @RequirePermissions("org:offers:manage")
  async revoke(@Req() req: Req_, @Param("orgId") orgId: string, @Param("offerId") offerId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.offers.revoke(actor, parseWithSchema(idSchema, orgId), parseWithSchema(idSchema, offerId), requestId);
    return ok(requestId, data);
  }

  @Post("offers/:offerId/confirm")
  @HttpCode(200)
  @RequirePermissions("org:offers:manage")
  async confirm(@Req() req: Req_, @Param("orgId") orgId: string, @Param("offerId") offerId: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    parseWithSchema(confirmSchema, body);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.offers.confirm(actor, parseWithSchema(idSchema, orgId), parseWithSchema(idSchema, offerId), requestId);
    return ok(requestId, data);
  }

  @Post("engagements/:engagementId/end")
  @HttpCode(200)
  @RequirePermissions("org:offers:manage")
  async end(
    @Req() req: Req_,
    @Param("orgId") orgId: string,
    @Param("engagementId") engagementId: string,
    @Body() body: unknown
  ) {
    const actor = resolveRequestContext(req);
    const { reason } = parseWithSchema(endSchema, body);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.offers.endEngagement(
      actor,
      parseWithSchema(idSchema, orgId),
      parseWithSchema(idSchema, engagementId),
      reason,
      requestId
    );
    return ok(requestId, data);
  }
}

/** BO-05: la persona ve y responde solo sus propias ofertas. */
@Controller("v1/offers")
export class MyOffersController {
  constructor(private readonly offers: OffersService) {}

  @Get("mine")
  @AuthenticatedAccess("La persona lee únicamente las ofertas dirigidas a su propio userId")
  async mine(@Req() req: Req_) {
    const actor = resolveRequestContext(req);
    const data = await this.offers.listMine({ userId: actor.userId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":offerId/respond")
  @HttpCode(200)
  @AuthenticatedAccess("El destinatario responde su propia oferta; la autorización es ser recipientUserId")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async respond(@Req() req: Req_, @Param("offerId") offerId: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const { decision } = parseWithSchema(respondSchema, body);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.offers.respond({ userId: actor.userId }, parseWithSchema(idSchema, offerId), decision, requestId);
    return ok(requestId, data);
  }
}
