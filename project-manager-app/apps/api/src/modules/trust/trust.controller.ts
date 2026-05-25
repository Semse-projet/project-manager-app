import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { Public } from "../../common/public.decorator.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { TrustPassportService } from "./trust-passport.service.js";
import { TrustService } from "./trust.service.js";

@Controller()
export class TrustController {
  constructor(
    private readonly trustService: TrustService,
    private readonly trustPassportService: TrustPassportService,
  ) {}

  @Get("v1/jobs/:jobId/trust")
  @RequirePermissions("trust:read")
  async byJob(@Req() req: { headers?: Record<string, unknown> }, @Param("jobId") jobId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.trustService.byJob({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      jobId,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("v1/projects/:projectId/trust")
  @RequirePermissions("trust:read")
  async byProject(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("projectId") projectId: string,
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.trustService.byProject({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      projectId,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  /** Issue a signed trust passport for a user. Self or OPS_ADMIN only. */
  @Get("v1/users/:userId/trust-passport")
  @RequirePermissions("trust:read")
  async issuePassport(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("userId") userId: string,
  ) {
    const actor = resolveRequestContext(req);
    this.trustPassportService.assertCanIssue(actor.userId, actor.roles, userId);
    const data = await this.trustPassportService.issue(actor.tenantId, userId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  /** Public endpoint — verify a trust passport token without authentication. */
  @Post("v1/trust-passport/verify")
  @Public()
  verifyPassport(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: { token: string },
  ) {
    const result = this.trustPassportService.verify(body?.token ?? "");
    return ok(resolveRequestId(req.headers ?? {}), result);
  }
}
