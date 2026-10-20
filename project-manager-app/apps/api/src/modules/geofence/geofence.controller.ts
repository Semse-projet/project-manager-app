import { Body, Controller, Get, HttpCode, Post, Put, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { AuthenticatedAccess } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { GeofenceService } from "./geofence.service.js";

type Req_ = { headers?: Record<string, unknown> };

const SELF = "La persona gestiona únicamente su propia preferencia de ubicación y sus propios eventos";

const preferenceSchema = z.object({
  mode: z.enum(["ASK", "AUTO", "OFF"]),
  autoStartConsent: z.boolean().optional()
});
const eventSchema = z.object({
  eventId: z.string().trim().min(8).max(100),
  type: z.enum(["ARRIVAL", "LEAVE", "OFF_SITE_AT_SHIFT"]),
  worksiteId: z.string().trim().min(1).max(64).optional(),
  occurredAt: z.coerce.date(),
  // Solo se acepta la precisión; el cuerpo NO admite coordenadas (el esquema las descarta).
  accuracyMeters: z.number().min(0).max(100_000).optional()
});

/** BO-09: preferencia de ubicación y decisión ante eventos de geocerca. Spec: docs/specs/core/geofence-policy.spec.md */
@Controller("v1/me")
export class GeofenceController {
  constructor(private readonly geofence: GeofenceService) {}

  @Get("location-preference")
  @AuthenticatedAccess(SELF)
  async getPreference(@Req() req: Req_) {
    const actor = resolveRequestContext(req);
    const data = await this.geofence.getPreference({ tenantId: actor.tenantId, orgId: actor.orgId, userId: actor.userId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Put("location-preference")
  @HttpCode(200)
  @AuthenticatedAccess(SELF)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async setPreference(@Req() req: Req_, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.geofence.setPreference(
      { tenantId: actor.tenantId, orgId: actor.orgId, userId: actor.userId },
      requestId,
      parseWithSchema(preferenceSchema, body)
    );
    return ok(requestId, data);
  }

  @Post("geofence-events")
  @HttpCode(200)
  @AuthenticatedAccess(SELF)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async evaluate(@Req() req: Req_, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const data = await this.geofence.evaluate(
      { tenantId: actor.tenantId, orgId: actor.orgId, userId: actor.userId },
      parseWithSchema(eventSchema, body)
    );
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("geofence-events")
  @AuthenticatedAccess(SELF)
  async list(@Req() req: Req_) {
    const actor = resolveRequestContext(req);
    const data = await this.geofence.listMine({ tenantId: actor.tenantId, orgId: actor.orgId, userId: actor.userId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
