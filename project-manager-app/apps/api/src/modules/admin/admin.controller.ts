import { Body, Controller, Get, Param, Post, Put, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { AdminService } from "./admin.service.js";
import { AdminIntegrationsService } from "./admin-integrations.service.js";
import { adminSettingsPatchSchema } from "@semse/schemas";

@Controller("v1/admin")
export class AdminController {
  constructor(
    private readonly svc: AdminService,
    private readonly integrations: AdminIntegrationsService,
  ) {}

  @Get("settings")
  @RequirePermissions("ops:dashboard:read")
  async getSettings(@Req() req: { headers?: Record<string, unknown> }) {
    const ctx = resolveRequestContext(req);
    const data = await this.svc.getSettings(ctx.tenantId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Put("settings")
  @RequirePermissions("ops:dashboard:write")
  async updateSettings(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>
  ) {
    const ctx = resolveRequestContext(req);
    const patch = adminSettingsPatchSchema.parse(body);
    const data = await this.svc.updateSettings(ctx.tenantId, patch, {
      userId: ctx.userId,
      requestId: resolveRequestId(req.headers ?? {}),
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("integrations/status")
  @RequirePermissions("ops:dashboard:read")
  async getIntegrationStatuses(@Req() req: { headers?: Record<string, unknown> }) {
    const ctx = resolveRequestContext(req);
    const data = await this.integrations.list(ctx.tenantId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("integrations/:integrationId/verify")
  @RequirePermissions("ops:dashboard:write")
  async verifyIntegration(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("integrationId") integrationId: string,
  ) {
    const ctx = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.integrations.verify(ctx.tenantId, integrationId, {
      userId: ctx.userId,
      requestId,
    });
    return ok(requestId, data);
  }
}
