import { randomUUID } from "node:crypto";
import {
  BadRequestException, Body, Controller, Delete, Get,
  Param, Patch, Post, Query, Req,
} from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { LaborEngineService } from "./labor-engine.service.js";
import { LaborChatService } from "./labor-chat.service.js";

function actor(req: { headers?: Record<string, unknown> }) {
  return resolveRequestContext(req);
}
function rid(req: { headers?: Record<string, unknown> }) {
  return resolveRequestId(req.headers ?? {});
}

@Controller("v1/labor")
export class LaborEngineController {
  constructor(
    private readonly svc: LaborEngineService,
    private readonly chat: LaborChatService,
  ) {}

  // ── Free Projects ─────────────────────────────────────────────────────────

  @Get("free-projects")
  @RequirePermissions("field-ops:read")
  async listFreeProjects(@Req() req: { headers?: Record<string, unknown> }) {
    const a = actor(req);
    const data = await this.svc.listFreeProjects(a.tenantId, a.userId);
    return ok(rid(req), data);
  }

  @Post("free-projects")
  @RequirePermissions("field-ops:write")
  async createFreeProject(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
  ) {
    const a = actor(req);
    if (typeof body["name"] !== "string") throw new BadRequestException("name required");
    const data = await this.svc.createFreeProject({
      tenantId: a.tenantId,
      createdBy: a.userId,
      name: body["name"],
      color: typeof body["color"] === "string" ? body["color"] : undefined,
      location: typeof body["location"] === "string" ? body["location"] : undefined,
      description: typeof body["description"] === "string" ? body["description"] : undefined,
    });
    return ok(rid(req), data);
  }

  @Patch("free-projects/:id")
  @RequirePermissions("field-ops:write")
  async updateFreeProject(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const a = actor(req);
    const data = await this.svc.updateFreeProject(id, a.tenantId, {
      name: typeof body["name"] === "string" ? body["name"] : undefined,
      color: typeof body["color"] === "string" ? body["color"] : undefined,
      location: typeof body["location"] === "string" ? body["location"] : undefined,
      description: typeof body["description"] === "string" ? body["description"] : undefined,
      status: typeof body["status"] === "string" ? body["status"] : undefined,
    });
    return ok(rid(req), data);
  }

  @Delete("free-projects/:id")
  @RequirePermissions("field-ops:write")
  async archiveFreeProject(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("id") id: string,
  ) {
    const a = actor(req);
    const data = await this.svc.archiveFreeProject(id, a.tenantId);
    return ok(rid(req), data);
  }

  @Post("free-projects/:id/convert")
  @RequirePermissions("field-ops:write")
  async convertFreeProject(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const a = actor(req);
    if (typeof body["jobId"] !== "string") throw new BadRequestException("jobId required");
    const data = await this.svc.convertToJob(id, a.tenantId, body["jobId"]);
    return ok(rid(req), data);
  }

  // ── Timer (realtime) ──────────────────────────────────────────────────────

  @Get("timer/active")
  @RequirePermissions("field-ops:read")
  async getActive(@Req() req: { headers?: Record<string, unknown> }) {
    const a = actor(req);
    const data = await this.svc.getActiveTimer(a.tenantId, a.userId);
    return ok(rid(req), data);
  }

  @Post("timer/start")
  @RequirePermissions("field-ops:write")
  async startTimer(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
  ) {
    const a = actor(req);
    const purpose = typeof body["purpose"] === "string" ? body["purpose"] : "personal";
    const data = await this.svc.startTimer({
      tenantId: a.tenantId,
      orgId: a.orgId,
      createdBy: a.userId,
      purpose,
      jobId: typeof body["jobId"] === "string" ? body["jobId"] : undefined,
      freeProjectId: typeof body["freeProjectId"] === "string" ? body["freeProjectId"] : undefined,
      notes: typeof body["notes"] === "string" ? body["notes"] : undefined,
    });
    return ok(rid(req), data);
  }

  @Post("timer/:id/pause")
  @Patch("timer/:id/pause")
  @RequirePermissions("field-ops:write")
  async pauseTimer(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("id") id: string,
  ) {
    const a = actor(req);
    const data = await this.svc.pauseTimer(id, a.tenantId, a.userId);
    return ok(rid(req), data);
  }

  @Post("timer/:id/resume")
  @Patch("timer/:id/resume")
  @RequirePermissions("field-ops:write")
  async resumeTimer(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("id") id: string,
  ) {
    const a = actor(req);
    const data = await this.svc.resumeTimer(id, a.tenantId, a.userId);
    return ok(rid(req), data);
  }

  @Post("timer/:id/stop")
  @Patch("timer/:id/stop")
  @RequirePermissions("field-ops:write")
  async stopTimer(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const a = actor(req);
    const notes = typeof body["notes"] === "string" ? body["notes"] : undefined;
    const data = await this.svc.stopTimer(id, a.tenantId, a.userId, notes);
    return ok(rid(req), data);
  }

  @Post("timer/:id/notes")
  @Patch("timer/:id/notes")
  @RequirePermissions("field-ops:write")
  async updateTimerNotes(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const a = actor(req);
    if (typeof body["notes"] !== "string") throw new BadRequestException("notes required");
    const data = await this.svc.updateTimerNotes(id, a.tenantId, a.userId, body["notes"]);
    return ok(rid(req), data);
  }

  // ── Manual entries ────────────────────────────────────────────────────────

  @Post("entries/manual")
  @RequirePermissions("field-ops:write")
  async createManual(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
  ) {
    const a = actor(req);
    if (typeof body["date"] !== "string") throw new BadRequestException("date required (YYYY-MM-DD)");
    if (typeof body["startTime"] !== "string") throw new BadRequestException("startTime required (HH:mm)");
    if (typeof body["endTime"] !== "string") throw new BadRequestException("endTime required (HH:mm)");
    const data = await this.svc.createManualEntry({
      tenantId: a.tenantId,
      orgId: a.orgId,
      createdBy: a.userId,
      purpose: typeof body["purpose"] === "string" ? body["purpose"] : "personal",
      jobId: typeof body["jobId"] === "string" ? body["jobId"] : undefined,
      freeProjectId: typeof body["freeProjectId"] === "string" ? body["freeProjectId"] : undefined,
      date: body["date"],
      startTime: body["startTime"],
      endTime: body["endTime"],
      breakMinutes: typeof body["breakMinutes"] === "number" ? body["breakMinutes"] : 0,
      hourlyRate: typeof body["hourlyRate"] === "number" ? body["hourlyRate"] : undefined,
      currency: typeof body["currency"] === "string" ? body["currency"] : undefined,
      location: typeof body["location"] === "string" ? body["location"] : undefined,
      notes: typeof body["notes"] === "string" ? body["notes"] : undefined,
    });
    return ok(rid(req), data);
  }

  @Get("entries")
  @RequirePermissions("field-ops:read")
  async listEntries(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("range") range?: string,
    @Query("jobId") jobId?: string,
    @Query("freeProjectId") freeProjectId?: string,
    @Query("purpose") purpose?: string,
    @Query("limit") limit?: string,
  ) {
    const a = actor(req);
    const data = await this.svc.listEntries({
      tenantId: a.tenantId,
      createdBy: a.userId,
      jobId,
      freeProjectId,
      purpose,
      range: range === "week" ? "week" : range === "month" ? "month" : "all",
      limit: limit ? Number.parseInt(limit, 10) : 50,
    });
    return ok(rid(req), data);
  }

  // ── Summaries ─────────────────────────────────────────────────────────────

  @Get("summary/week")
  @RequirePermissions("field-ops:read")
  async weeklySummary(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("offset") offset?: string,
  ) {
    const a = actor(req);
    const weekOffset = offset ? Number.parseInt(offset, 10) : 0;
    const data = await this.svc.getWeeklySummary(a.tenantId, a.userId, weekOffset);
    return ok(rid(req), data);
  }

  @Get("summary/month")
  @RequirePermissions("field-ops:read")
  async monthlySummary(@Req() req: { headers?: Record<string, unknown> }) {
    const a = actor(req);
    const data = await this.svc.getMonthlySummary(a.tenantId, a.userId);
    return ok(rid(req), data);
  }

  // ── Chat (Cronos, vía Ollama local) ───────────────────────────────────────

  @Post("chat")
  @RequirePermissions("field-ops:read")
  async chatWithCronos(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
  ) {
    const a = actor(req);
    const message = typeof body["message"] === "string" ? body["message"].trim() : "";
    if (!message) throw new BadRequestException("message is required");
    const threadId = typeof body["threadId"] === "string" && body["threadId"].trim().length > 0
      ? body["threadId"].trim()
      : randomUUID();

    const data = await this.chat.chat({
      tenantId: a.tenantId,
      orgId: a.orgId,
      userId: a.userId,
      message,
      threadId,
    });
    return ok(rid(req), data);
  }
}
