import { Controller, Get, Patch, Post, Param, Query, Req } from "@nestjs/common";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseHeaderRequestContext } from "../../common/request-context.js";
import { ok } from "../../common/api-response.js";
import { OperationalSignalsService } from "./operational-signals.service.js";
import { IntelligenceRunsService } from "./intelligence-runs.service.js";
import { PrometeoBriefService } from "./prometeo-brief.service.js";
import { parsePositiveInt } from "../../common/parse-query.js";

@Controller("v1/operational-intelligence")
export class OperationalIntelligenceController {
  constructor(
    private readonly signals: OperationalSignalsService,
    private readonly runs: IntelligenceRunsService,
    private readonly brief: PrometeoBriefService,
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
      limit: parsePositiveInt(limit, 50),
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
      parsePositiveInt(limit, 20),
    );
    return ok(requestId, results);
  }

  @Post("seed-test")
  @RequirePermissions("ops:dashboard:write")
  async seedTestSignals(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ctx = parseHeaderRequestContext(req);

    const testSignals = [
      {
        tenantId: ctx.tenantId,
        type: "EVIDENCE_GAP" as const,
        severity: "high" as const,
        title: "Evidencia incompleta — Test",
        message: "Milestone de prueba con 2 evidencias faltantes.",
        recommendedAction: "Solicitar evidencia faltante al profesional.",
        sourceAgent: "test:seed",
        entityType: "Milestone",
        entityId: `test-milestone-${Date.now()}`,
        milestoneId: `test-ms-${Date.now()}`,
        metadataJson: { missingCount: 2, test: true },
      },
      {
        tenantId: ctx.tenantId,
        type: "PAYMENT_BLOCKED" as const,
        severity: "high" as const,
        title: "Pago bloqueado — Test",
        message: "paymentReadiness=not_ready en milestone pendiente de aprobación.",
        recommendedAction: "Revisar evidencia antes de aprobar el pago.",
        sourceAgent: "test:seed",
        entityType: "Milestone",
        entityId: `test-milestone-pay-${Date.now()}`,
        milestoneId: `test-ms-pay-${Date.now()}`,
        metadataJson: { test: true },
      },
      {
        tenantId: ctx.tenantId,
        type: "DISPUTE_RISK_HIGH" as const,
        severity: "critical" as const,
        title: "Riesgo de disputa — Test",
        message: "Evidencia rechazada + pago solicitado + change order activo.",
        recommendedAction: "Revisar antes de liberar cualquier pago.",
        sourceAgent: "test:seed",
        entityType: "Milestone",
        entityId: `test-milestone-dispute-${Date.now()}`,
        milestoneId: `test-ms-dispute-${Date.now()}`,
        metadataJson: { test: true },
      },
    ];

    const results = await Promise.all(
      testSignals.map((s) => this.signals.upsertSignal(s)),
    );

    const created = results.filter((r) => r.created).length;
    return ok(requestId, { seeded: created, total: testSignals.length, message: "Test signals created — go to /admin/mission-control" });
  }

  @Get("brief")
  @RequirePermissions("ops:dashboard:read")
  async getBrief(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("buildOpsProjectId") buildOpsProjectId?: string,
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ctx = parseHeaderRequestContext(req);
    const result = await this.brief.generateBrief(ctx.tenantId, buildOpsProjectId);
    return ok(requestId, result);
  }
}
