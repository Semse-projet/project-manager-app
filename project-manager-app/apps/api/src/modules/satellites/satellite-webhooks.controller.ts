import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { Public } from "../../common/public.decorator.js";
import { resolveRequestId } from "../../common/request-id.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { hasPermission } from "../../common/rbac.js";
import { extractBearerToken } from "./satellite-scope.guard.js";
import { SatelliteWebhooksService, SATELLITE_WEBHOOK_EVENT_CATALOG } from "./satellite-webhooks.service.js";
import { SatellitesService, type SatelliteIdentity } from "./satellites.service.js";

const registerWebhookSchema = z.object({
  url: z.string().trim().url(),
  events: z.array(z.enum(SATELLITE_WEBHOOK_EVENT_CATALOG as [string, ...string[]])).min(1),
  secret: z.string().trim().min(32).max(512).optional(),
});

type RequestLike = { headers?: Record<string, unknown> };

/**
 * SAT-007 spec §5: satellite-token auth for register/list-own/delete-own;
 * `satellites:admin` (RBAC) for list-all/delete-any. Neither
 * SatelliteScopeGuard (always requires a satellite token) nor RbacGuard's
 * permission decorator (always requires RBAC headers) supports this "OR"
 * on their own, so this controller is @Public() (bypasses the global RBAC
 * guard) and resolves whichever identity is actually present itself.
 */
@Controller("v1/satellites/webhooks")
@Public()
export class SatelliteWebhooksController {
  constructor(
    private readonly webhooksService: SatelliteWebhooksService,
    private readonly satellitesService: SatellitesService,
  ) {}

  @Post()
  async register(@Req() req: RequestLike, @Body() body: unknown) {
    const satellite = await this.requireSatellite(req);
    const parsed = registerWebhookSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const data = await this.webhooksService.register({
      satellite,
      url: parsed.data.url,
      events: parsed.data.events,
      secret: parsed.data.secret,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get()
  async list(@Req() req: RequestLike) {
    const admin = this.tryResolveAdmin(req);
    if (admin) {
      const data = await this.webhooksService.listAll();
      return ok(resolveRequestId(req.headers ?? {}), data);
    }

    const satellite = await this.requireSatellite(req);
    const data = await this.webhooksService.listForSatellite(satellite);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Delete(":id")
  async revoke(@Req() req: RequestLike, @Param("id") id: string) {
    const admin = this.tryResolveAdmin(req);
    if (admin) {
      const data = await this.webhooksService.revoke({ id, isAdmin: true });
      return ok(resolveRequestId(req.headers ?? {}), data);
    }

    const satellite = await this.requireSatellite(req);
    const data = await this.webhooksService.revoke({ id, satellite, isAdmin: false });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  private tryResolveAdmin(req: RequestLike): boolean {
    try {
      const actor = resolveRequestContext(req as never);
      return hasPermission(actor.roles, "satellites:admin");
    } catch {
      return false;
    }
  }

  // Only register() requires the events:subscribe scope (enforced in
  // SatelliteWebhooksService) — a satellite must always be able to list or
  // delete its own webhooks even if its token's scopes were narrowed after
  // those webhooks were created.
  private async requireSatellite(req: RequestLike): Promise<SatelliteIdentity> {
    const token = extractBearerToken(req.headers ?? {});
    if (!token) {
      throw new UnauthorizedException({
        message: "Missing satellite token — expected 'Authorization: Bearer sst_...'",
      });
    }
    return this.satellitesService.verifyToken(token);
  }
}
