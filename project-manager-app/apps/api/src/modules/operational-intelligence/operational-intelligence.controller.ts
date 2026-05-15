import { Controller, Get, Patch, Param, Query, Req } from "@nestjs/common";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseHeaderRequestContext } from "../../common/request-context.js";
import { ok } from "../../common/api-response.js";
import { OperationalSignalsService } from "./operational-signals.service.js";
import { IntelligenceRunsService } from "./intelligence-runs.service.js";

@Controller("v1/operational-intelligence")
export class OperationalIntelligenceController {
  constructor(
    private readonly signals: OperationalSignalsService,
    private readonly runs: IntelligenceRunsService,
  ) {}

  @Get("signals")
  @RequirePermissions("ops:dashboard:read")
  async listSignals(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("status") status?: string,
    @Query("severity") severity?: string,
    @Query("type") type?: string,
    @Query("jobId") jobId?: string,
    @Query("buildOpsProjectId") buildOpsProjectId?: string,
    @Query("milestoneId") milestoneId?: string,
    @Query("limit") limit?: string,
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ctx = parseHeaderRequestContext(req);
    const results = await this.signals.list({
      tenantId: ctx.tenantId,
      status,
      severity,
      type,
      jobId,
      buildOpsProjectId,
      milestoneId,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    return ok(requestId, results);
  }

  @Patch("signals/:id/acknowledge")
  @RequirePermissions("ops:dashboard:write")
  async acknowledgeSignal(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("id") id: string,
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ctx = parseHeaderRequestContext(req);
    await this.signals.acknowledge(id, ctx.tenantId);
    return ok(requestId, { acknowledged: true });
  }

  @Patch("signals/:id/resolve")
  @RequirePermissions("ops:dashboard:write")
  async resolveSignal(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("id") id: string,
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ctx = parseHeaderRequestContext(req);
    await this.signals.resolve(id, ctx.tenantId);
    return ok(requestId, { resolved: true });
  }

  @Patch("signals/:id/dismiss")
  @RequirePermissions("ops:dashboard:write")
  async dismissSignal(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("id") id: string,
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ctx = parseHeaderRequestContext(req);
    await this.signals.dismiss(id, ctx.tenantId);
    return ok(requestId, { dismissed: true });
  }

  @Get("runs")
  @RequirePermissions("ops:dashboard:read")
  async listRuns(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("limit") limit?: string,
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ctx = parseHeaderRequestContext(req);
    const results = await this.runs.listRecent(
      ctx.tenantId,
      limit ? parseInt(limit, 10) : 20,
    );
    return ok(requestId, results);
  }
}
