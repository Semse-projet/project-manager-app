import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { AgroDashboardService } from "./agro-dashboard.service.js";
import { AgroAuditReportService } from "./agro-audit-report.service.js";
import { AgroSyncService } from "./agro-sync.service.js";

const syncEventSchema = z.object({
  clientEventId: z.string().min(1),
  farmId:        z.string().min(1),
  action:        z.string().min(1),
  payload:       z.record(z.unknown()),
  occurredAt:    z.string(),
});

const syncBatchSchema = z.object({
  events: z.array(syncEventSchema).min(1).max(100),
});

@Controller("v1/agro")
export class AgroDashboardController {
  constructor(
    private readonly dashboard: AgroDashboardService,
    private readonly auditReport: AgroAuditReportService,
    private readonly sync: AgroSyncService,
  ) {}

  @Get("farms/:farmId/dashboard")
  @RequirePermissions("agro:read")
  async getDashboard(@Param("farmId") farmId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const data = await this.dashboard.getDashboard(farmId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("farms/:farmId/audit-report")
  @RequirePermissions("agro:read")
  async generateAuditReport(@Param("farmId") farmId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const report = await this.auditReport.generateWeeklyReport(farmId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { report });
  }

  @Post("sync/events")
  @RequirePermissions("agro:write")
  async syncEvents(@Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const { events } = syncBatchSchema.parse(body);
    const results = await this.sync.processSyncEvents(ctx.userId, events as any);
    return ok(resolveRequestId(req.headers ?? {}), { results });
  }
}
