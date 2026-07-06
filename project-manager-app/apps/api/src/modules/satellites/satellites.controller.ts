import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { Public } from "../../common/public.decorator.js";
import { resolveRequestId } from "../../common/request-id.js";
import { SatelliteScopeGuard } from "./satellite-scope.guard.js";
import { SATELLITE_SCOPE_CATALOG, SatellitesService, type SatelliteIdentity } from "./satellites.service.js";

const issueTokenSchema = z.object({
  name: z.string().min(2).max(60).regex(/^[a-z0-9][a-z0-9-]*$/, "kebab-case only"),
  scopes: z.array(z.enum(SATELLITE_SCOPE_CATALOG)).min(1),
  expiresAt: z.string().datetime().optional()
});

@Controller("v1/satellites")
export class SatellitesController {
  constructor(private readonly satellitesService: SatellitesService) {}

  @Post("tokens")
  @RequirePermissions("satellites:admin")
  async issueToken(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const parsed = issueTokenSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const data = await this.satellitesService.issueToken(parsed.data);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("tokens")
  @RequirePermissions("satellites:admin")
  async listTokens(@Req() req: { headers?: Record<string, unknown> }) {
    const data = await this.satellitesService.listTokens();
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Delete("tokens/:id")
  @RequirePermissions("satellites:admin")
  async revokeToken(@Req() req: { headers?: Record<string, unknown> }, @Param("id") id: string) {
    const data = await this.satellitesService.revokeToken(id);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  /**
   * Introspección para satélites: smoke de conectividad del SDK (anillo 4,
   * SAT-000). Público para el auth de usuarios; protegido por satellite token.
   */
  @Get("me")
  @Public()
  @UseGuards(SatelliteScopeGuard)
  async me(@Req() req: { headers?: Record<string, unknown>; satellite?: SatelliteIdentity }) {
    const satellite = req.satellite as SatelliteIdentity;
    return ok(resolveRequestId(req.headers ?? {}), {
      name: satellite.name,
      scopes: satellite.scopes
    });
  }
}
