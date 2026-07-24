import {
  BadRequestException, Body, Controller,
  Get, Param, Post, Put, Query, Req,
} from "@nestjs/common";
import {
  createManualTrackerSessionSchema,
  startTrackerSessionSchema,
  trackerSessionMutationSchema
} from "@semse/schemas";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { FieldOpsService } from "./field-ops.service.js";

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const createUnitSchema = z.object({
  projectId: z.string().min(1),
  code:      z.string().min(1),
  name:      z.string().optional(),
  address:   z.string().optional(),
});

const updateUnitStatusSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETE", "ON_HOLD", "CANCELLED"]),
});

const createWorklogSchema = z.object({
  fieldUnitId: z.string().min(1),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  doneToday:   z.string().min(1),
  pendingNext: z.string().min(1),
  blockers:    z.string().optional(),
  notes:       z.string().optional(),
});

const createFactSchema = z.object({
  subject:    z.string().min(1),
  predicate:  z.string().min(1),
  object:     z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  worklogId:  z.string().optional(),
});

const createVendorSchema = z.object({
  name:  z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  notes: z.string().optional(),
});

const upsertComplianceSchema = z.object({
  type:      z.string().min(1),
  status:    z.enum(["MISSING", "PENDING", "APPROVED", "EXPIRED"]),
  fileUrl:   z.string().url().optional(),
  expiresAt: z.string().optional(),
  notes:     z.string().optional(),
});

// ── Controller ────────────────────────────────────────────────────────────────

@Controller("v1/field-ops")
export class FieldOpsController {
  constructor(private readonly service: FieldOpsService) {}

  // ── Units ──────────────────────────────────────────────────────────────────

  @Get("units")
  @RequirePermissions("field-ops:read")
  async listUnits(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("projectId") projectId?: string,
    @Query("status") status?: string,
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.service.listUnits({ tenantId: actor.tenantId, projectId, status });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("units/:unitId")
  @RequirePermissions("field-ops:read")
  async getUnit(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("unitId") fieldUnitId: string,
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.service.findUnit({ tenantId: actor.tenantId, fieldUnitId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("units")
  @RequirePermissions("field-ops:write")
  async createUnit(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = createUnitSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const data = await this.service.createUnit({ tenantId: actor.tenantId, ...parsed.data });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Put("units/:unitId/status")
  @RequirePermissions("field-ops:write")
  async updateUnitStatus(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("unitId") fieldUnitId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = updateUnitStatusSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const data = await this.service.updateUnitStatus({ tenantId: actor.tenantId, fieldUnitId, status: parsed.data.status });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  // ── Worklogs ───────────────────────────────────────────────────────────────

  @Get("worklogs")
  @RequirePermissions("field-ops:read")
  async listWorklogs(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("fieldUnitId") fieldUnitId?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.service.listWorklogs({ tenantId: actor.tenantId, fieldUnitId, dateFrom, dateTo });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("worklogs")
  @RequirePermissions("field-ops:write")
  async createWorklog(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = createWorklogSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const data = await this.service.createWorklog({
      tenantId: actor.tenantId,
      createdBy: actor.userId,
      ...parsed.data,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  // ── Tracker Sessions ─────────────────────────────────────────────────────

  @Get("tracker")
  @RequirePermissions("field-ops:read")
  async getTrackerSnapshot(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.service.getTrackerSnapshot({
      tenantId: actor.tenantId,
      createdBy: actor.userId,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("tracker/start")
  @RequirePermissions("field-ops:write")
  async startTrackerSession(
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

  @Post("tracker/manual")
  @RequirePermissions("field-ops:write")
  async createManualTrackerSession(
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

  // NOTE (2.37): duplicates TimeTrackerController's
  // POST /v1/time-tracker/sessions/:sessionId/pause|resume — both call the
  // exact same FieldOpsService methods below. The frontend's canonical
  // /worker/field-ops Tracker tab now calls the /v1/time-tracker/sessions/...
  // path (matching the rest of its own calls); as of this fix, nothing in
  // apps/web calls these /v1/field-ops/tracker/:sessionId/pause|resume routes
  // anymore. Left in place rather than removed in case an external client
  // depends on them — no test/route audit was done to confirm that.
  @Post("tracker/:sessionId/pause")
  @RequirePermissions("field-ops:write")
  async pauseTrackerSession(
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

  @Post("tracker/:sessionId/resume")
  @RequirePermissions("field-ops:write")
  async resumeTrackerSession(
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

  @Post("tracker/:sessionId/stop")
  @RequirePermissions("field-ops:write")
  async stopTrackerSession(
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

  // ── Knowledge Facts ────────────────────────────────────────────────────────

  @Get("facts")
  @RequirePermissions("field-ops:read")
  async listFacts(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("subject") subject?: string,
    @Query("predicate") predicate?: string,
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.service.listFacts({ tenantId: actor.tenantId, subject, predicate });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("facts")
  @RequirePermissions("field-ops:write")
  async createFact(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = createFactSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const data = await this.service.createFact({
      tenantId: actor.tenantId,
      createdBy: actor.userId,
      ...parsed.data,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  // ── Vendors ────────────────────────────────────────────────────────────────

  @Get("vendors")
  @RequirePermissions("field-ops:read")
  async listVendors(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.service.listVendors({ tenantId: actor.tenantId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("vendors")
  @RequirePermissions("field-ops:write")
  async createVendor(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = createVendorSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const data = await this.service.createVendor({ tenantId: actor.tenantId, ...parsed.data });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Put("vendors/:vendorId/compliance")
  @RequirePermissions("field-ops:write")
  async upsertCompliance(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("vendorId") vendorId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = upsertComplianceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const data = await this.service.upsertComplianceDoc({ tenantId: actor.tenantId, vendorId, ...parsed.data });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
