import { Controller, Get, Param, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { TrustService } from "./trust.service.js";

@Controller()
export class TrustController {
  constructor(private readonly trustService: TrustService) {}

  @Get("v1/jobs/:jobId/trust")
  @RequirePermissions("trust:read")
  async byJob(@Req() req: { headers?: Record<string, unknown> }, @Param("jobId") jobId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.trustService.byJob({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      jobId
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("v1/projects/:projectId/trust")
  @RequirePermissions("trust:read")
  async byProject(@Req() req: { headers?: Record<string, unknown> }, @Param("projectId") projectId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.trustService.byProject({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      projectId
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
