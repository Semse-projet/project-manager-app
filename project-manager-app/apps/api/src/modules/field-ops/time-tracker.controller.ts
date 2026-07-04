import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import {
  createManualTrackerSessionSchema,
  startTrackerSessionSchema,
  trackerSessionMutationSchema,
} from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { FieldOpsService } from "./field-ops.service.js";

@Controller("v1/time-tracker")
export class TimeTrackerController {
  constructor(private readonly service: FieldOpsService) {}

  @Get()
  @RequirePermissions("field-ops:read")
  async snapshot(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.service.getTrackerBootstrap({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      createdBy: actor.userId,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("jobs")
  @RequirePermissions("field-ops:read")
  async listJobs(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.service.listTrackerJobs({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      createdBy: actor.userId,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("active")
  @RequirePermissions("field-ops:read")
  async active(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.service.getActiveTrackerSession({
      tenantId: actor.tenantId,
      createdBy: actor.userId,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("sessions")
  @RequirePermissions("field-ops:read")
  async sessions(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("limit") limit?: string,
    @Query("range") range?: string,
    @Query("jobId") jobId?: string,
    @Query("status") status?: string,
  ) {
    const actor = resolveRequestContext(req);
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    const data = await this.service.listTrackerSessions({
      tenantId: actor.tenantId,
      createdBy: actor.userId,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      range: range === "week" || range === "month" || range === "all" ? range : undefined,
      jobId,
      status: status === "RUNNING" || status === "PAUSED" || status === "STOPPED" ? status : undefined,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("summary")
  @RequirePermissions("field-ops:read")
  async summary(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("range") range?: string,
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.service.getTrackerSummary({
      tenantId: actor.tenantId,
      createdBy: actor.userId,
      range: range === "month" ? "month" : "week",
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("sessions/start")
  @RequirePermissions("field-ops:write")
  async start(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = startTrackerSessionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.service.startTrackerSession({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      createdBy: actor.userId,
      requestId,
      ...parsed.data,
    });
    return ok(requestId, data);
  }

  @Post("sessions/manual")
  @RequirePermissions("field-ops:write")
  async manual(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = createManualTrackerSessionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.service.createManualTrackerSession({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      createdBy: actor.userId,
      requestId,
      ...parsed.data,
    });
    return ok(requestId, data);
  }

  @Post("sessions/:sessionId/pause")
  @RequirePermissions("field-ops:write")
  async pause(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("sessionId") sessionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = trackerSessionMutationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.service.pauseTrackerSession({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      createdBy: actor.userId,
      requestId,
      sessionId,
      ...parsed.data,
    });
    return ok(requestId, data);
  }

  @Post("sessions/:sessionId/resume")
  @RequirePermissions("field-ops:write")
  async resume(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("sessionId") sessionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = trackerSessionMutationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.service.resumeTrackerSession({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      createdBy: actor.userId,
      requestId,
      sessionId,
      ...parsed.data,
    });
    return ok(requestId, data);
  }

  @Post("sessions/:sessionId/stop")
  @Patch("sessions/:sessionId/stop")
  @RequirePermissions("field-ops:write")
  async stop(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("sessionId") sessionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = trackerSessionMutationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.service.stopTrackerSession({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      createdBy: actor.userId,
      requestId,
      sessionId,
      ...parsed.data,
    });
    return ok(requestId, data);
  }

  @Post("sessions/:sessionId/notes")
  @RequirePermissions("field-ops:write")
  async notes(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("sessionId") sessionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = trackerSessionMutationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const data = await this.service.updateTrackerSessionNotes({
      tenantId: actor.tenantId,
      createdBy: actor.userId,
      sessionId,
      ...parsed.data,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
