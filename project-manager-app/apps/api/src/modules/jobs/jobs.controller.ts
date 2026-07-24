import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { createRuntimeJobSchema, listJobsQuerySchema } from "@semse/schemas";
import { z } from "zod";

const transitionJobSchema = z.object({
  targetStatus: z.enum(["posted", "reserved", "accepted", "in_progress", "review", "completed", "cancelled", "dispute", "awarded"])
});
import { ok } from "../../common/api-response.js";
import { toVisibleJob } from "../../common/visible-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { JobsService } from "./jobs.service.js";

@Controller("v1/jobs")
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @RequirePermissions("jobs:read")
  async list(@Req() req: { headers?: Record<string, unknown> }, @Query() query: Record<string, unknown>) {
    const parsed = listJobsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const data = await this.jobsService.list({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      status: parsed.data.status
    });
    return ok(resolveRequestId(req.headers ?? {}), data.map((job) => toVisibleJob(job)));
  }

  @Get(":jobId")
  @RequirePermissions("jobs:read")
  async detail(@Req() req: { headers?: Record<string, unknown> }, @Param("jobId") jobId: string) {
    const actor = resolveRequestContext(req);
    const job = await this.jobsService.detail({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      jobId
    });
    return ok(resolveRequestId(req.headers ?? {}), toVisibleJob(job));
  }

  @Get(":jobId/agent-signals")
  @RequirePermissions("jobs:read")
  async agentSignals(@Req() req: { headers?: Record<string, unknown> }, @Param("jobId") jobId: string) {
    const actor = resolveRequestContext(req);
    const signals = await this.jobsService.agentSignals({
      tenantId: actor.tenantId,
      jobId
    });
    return ok(resolveRequestId(req.headers ?? {}), { signals });
  }

  @Post()
  @RequirePermissions("jobs:create")
  async create(@Req() req: { headers?: Record<string, unknown> }, @Body() body: Record<string, unknown>) {
    const parsed = createRuntimeJobSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const job = await this.jobsService.create({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      title: parsed.data.title,
      category: parsed.data.category,
      scope: parsed.data.scope,
      budgetType: parsed.data.budgetType,
      budgetMin: parsed.data.budgetMin,
      budgetMax: parsed.data.budgetMax,
      locationType: parsed.data.locationType,
      city: parsed.data.city,
      urgency: parsed.data.urgency,
      deadline: parsed.data.deadline,
      preferredProfessional: parsed.data.preferredProfessional,
      requestId
    });

    return ok(requestId, toVisibleJob(job));
  }

  @Patch(":jobId")
  @RequirePermissions("jobs:update")
  async update(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("jobId") jobId: string,
    @Body() body: Record<string, unknown>
  ) {
    const patchSchema = createRuntimeJobSchema.partial();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const job = await this.jobsService.update({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      jobId,
      patch: parsed.data,
      requestId
    });

    return ok(requestId, toVisibleJob(job));
  }

  @Post(":jobId/archive")
  @RequirePermissions("jobs:archive")
  async archive(@Req() req: { headers?: Record<string, unknown> }, @Param("jobId") jobId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const archived = await this.jobsService.archive({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      jobId,
      requestId
    });

    return ok(requestId, archived);
  }

  @Post(":jobId/transition")
  @RequirePermissions("jobs:update")
  async transition(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("jobId") jobId: string,
    @Body() body: Record<string, unknown>
  ) {
    const parsed = transitionJobSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const job = await this.jobsService.transitionJob({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      jobId,
      targetStatus: parsed.data.targetStatus,
      requestId
    });

    return ok(requestId, toVisibleJob(job));
  }

  @Post(":jobId/restore")
  @RequirePermissions("jobs:restore")
  async restore(@Req() req: { headers?: Record<string, unknown> }, @Param("jobId") jobId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const restored = await this.jobsService.restore({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      jobId,
      requestId
    });

    return ok(requestId, restored);
  }
}
