import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import {
  milestoneCreateSchema,
  milestoneReasonSchema
} from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { toVisibleMilestone } from "../../common/visible-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { MilestonesService } from "./milestones.service.js";

@Controller()
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post("v1/projects/:projectId/milestones")
  @RequirePermissions("milestones:create")
  async create(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("projectId") projectId: string,
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(milestoneCreateSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const milestone = await this.milestonesService.create({
      tenantId: actor.tenantId,
      projectId,
      title: parsed.title,
      amount: parsed.amount,
      sequence: parsed.sequence,
      userId: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles,
      requestId
    });

    return ok(requestId, toVisibleMilestone(milestone));
  }

  @Post("v1/jobs/:jobId/milestones")
  @RequirePermissions("milestones:create")
  async createByJob(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("jobId") jobId: string,
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(milestoneCreateSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const milestone = await this.milestonesService.createByJob({
      tenantId: actor.tenantId,
      jobId,
      title: parsed.title,
      amount: parsed.amount,
      sequence: parsed.sequence,
      userId: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles,
      requestId
    });

    return ok(requestId, toVisibleMilestone(milestone));
  }

  @Get("v1/jobs/:jobId/milestones")
  @RequirePermissions("milestones:read")
  async listByJob(@Req() req: { headers?: Record<string, unknown> }, @Param("jobId") jobId: string) {
    const actor = resolveRequestContext(req);
    const milestones = await this.milestonesService.listByJob({
      tenantId: actor.tenantId,
      jobId,
      userId: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles
    });
    return ok(resolveRequestId(req.headers ?? {}), milestones.map((item) => toVisibleMilestone(item)));
  }

  @Post("v1/milestones/:milestoneId/submit")
  @RequirePermissions("milestones:submit")
  async submit(@Req() req: { headers?: Record<string, unknown> }, @Param("milestoneId") milestoneId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const milestone = await this.milestonesService.submit({
      tenantId: actor.tenantId,
      milestoneId,
      userId: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles,
      requestId
    });
    return ok(requestId, toVisibleMilestone(milestone));
  }

  @Post("v1/milestones/:milestoneId/approve")
  @RequirePermissions("milestones:approve")
  async approve(@Req() req: { headers?: Record<string, unknown> }, @Param("milestoneId") milestoneId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const milestone = await this.milestonesService.approve({
      tenantId: actor.tenantId,
      milestoneId,
      userId: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles,
      requestId
    });
    return ok(requestId, toVisibleMilestone(milestone));
  }

  @Post("v1/milestones/:milestoneId/reject")
  @RequirePermissions("milestones:reject")
  async reject(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") milestoneId: string,
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(milestoneReasonSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const milestone = await this.milestonesService.reject({
      tenantId: actor.tenantId,
      milestoneId,
      reason: parsed.reason,
      userId: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles,
      requestId
    });
    return ok(requestId, toVisibleMilestone(milestone));
  }

  @Post("v1/milestones/:milestoneId/request-changes")
  @RequirePermissions("milestones:reject")
  async requestChanges(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") milestoneId: string,
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(milestoneReasonSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const milestone = await this.milestonesService.requestChanges({
      tenantId: actor.tenantId,
      milestoneId,
      reason: parsed.reason,
      userId: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles,
      requestId
    });
    return ok(requestId, toVisibleMilestone(milestone));
  }
}
