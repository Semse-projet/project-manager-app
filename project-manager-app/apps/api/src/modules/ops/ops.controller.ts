import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import {
  alertIdParamSchema,
  agentApprovalDecisionSchema,
  approvalIdParamSchema,
  correlationIdParamSchema,
  opsAgentRuntimeQuerySchema,
  opsIncidentSchema,
  runbookIdParamSchema,
  runIdParamSchema
} from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { LLMOrchestrator } from "../../infrastructure/llm/orchestrator.js";
import { OpsService } from "./ops.service.js";
import { AlgorithmRunService } from "../tools/algorithm-run.service.js";

@Controller("v1/ops")
export class OpsController {
  constructor(
    private readonly opsService: OpsService,
    private readonly llmOrchestrator: LLMOrchestrator,
    private readonly algorithmRunService: AlgorithmRunService,
  ) {}

  @Get("llm/metrics")
  @RequirePermissions("ops:dashboard:read")
  getLLMMetrics(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    return ok(requestId, this.llmOrchestrator.metricsSnapshot());
  }

  // ── AI Mission Control ─────────────────────────────────────────────────────

  @Get("ai-mission-control/summary")
  @RequirePermissions("ops:dashboard:read")
  async getAIMissionControlSummary(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    const providers = this.llmOrchestrator.getRegisteredProviders();
    const snapshots = this.llmOrchestrator.metricsSnapshot();

    const totalCalls   = snapshots.reduce((s, p) => s + p.successCount + p.failureCount, 0);
    const totalSuccess = snapshots.reduce((s, p) => s + p.successCount, 0);
    const fallbacks    = snapshots.filter((p) => p.provider !== "ollama" && p.successCount > 0);
    const ollamaSnap   = snapshots.find((p) => p.provider === "ollama" && p.taskType === "chat");

    return ok(requestId, {
      nativeProvider:    "ollama",
      registeredProviders: providers,
      totalLLMCalls:     totalCalls,
      successRate:       totalCalls > 0 ? Math.round(totalSuccess / totalCalls * 100) : 100,
      fallbackEvents:    fallbacks.reduce((s, p) => s + p.successCount, 0),
      ollamaAvgLatencyMs: ollamaSnap?.avgLatencyMs ?? 0,
      ollamaCircuitState: ollamaSnap?.circuitState ?? "closed",
      privacyGuard:      { localOnlyEnforced: true, cloudBlockedForPrivateCritical: true },
      llmDefaultProvider: process.env.LLM_DEFAULT_PROVIDER ?? "ollama",
      generatedAt:       new Date().toISOString(),
    });
  }

  @Get("ai-mission-control/providers")
  @RequirePermissions("ops:dashboard:read")
  async getAIProviders(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    const health = await this.llmOrchestrator.providerHealthSummary();
    return ok(requestId, health);
  }

  @Get("ai-mission-control/llm-runs")
  @RequirePermissions("ops:dashboard:read")
  getAILLMRuns(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    return ok(requestId, this.llmOrchestrator.metricsSnapshot());
  }

  @Get("audit")
  @RequirePermissions("ops:audit:read")
  async audit(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.opsService.audit({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("risk-scores")
  @RequirePermissions("ops:risk:read")
  async riskScores(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.opsService.riskScores({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("trust-overview")
  @RequirePermissions("ops:risk:read")
  async trustOverview(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.opsService.trustOverview({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("dashboard")
  @RequirePermissions("ops:dashboard:read")
  async dashboard(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.opsService.dashboard({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("agent-runtime")
  @RequirePermissions("ops:dashboard:read")
  async agentRuntime(
    @Req() req: {
      headers?: Record<string, unknown>;
      query?: Record<string, string | string[] | undefined>;
    }
  ) {
    const actor = resolveRequestContext(req);
    const query = parseWithSchema(opsAgentRuntimeQuerySchema, req.query ?? {});
    const data = await this.opsService.agentRuntime({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      correlationId: query.correlationId,
      eventType: query.eventType,
      agentType: query.agentType,
      status: query.status,
      triggerType: query.triggerType,
      workspaceId: query.workspaceId,
      operatorId: query.operatorId,
      memoryTag: query.memoryTag,
      limit: query.limit
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("agent-runtime/:correlationId")
  @RequirePermissions("ops:dashboard:read")
  async agentRuntimeTrace(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("correlationId") correlationId: string
  ) {
    const parsedParams = parseWithSchema(correlationIdParamSchema, { correlationId });
    const actor = resolveRequestContext(req);
    const data = await this.opsService.agentRuntimeTrace({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      correlationId: parsedParams.correlationId
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("approvals/:approvalId/decision")
  @RequirePermissions("ops:risk:read")
  async approvalDecision(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("approvalId") approvalId: string,
    @Body() body: unknown
  ) {
    const parsedParams = parseWithSchema(approvalIdParamSchema, { approvalId });
    const parsedBody = parseWithSchema(agentApprovalDecisionSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.opsService.approvalDecision({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      approvalId: parsedParams.approvalId,
      decision: parsedBody.decision,
      comment: parsedBody.comment,
      requestId
    });
    return ok(requestId, data);
  }

  @Post("alerts/:alertId/ack")
  @RequirePermissions("ops:alerts:ack")
  async acknowledgeAlert(@Req() req: { headers?: Record<string, unknown> }, @Param("alertId") alertId: string) {
    const parsedParams = parseWithSchema(alertIdParamSchema, { alertId });
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.opsService.acknowledgeAlert({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      alertId: parsedParams.alertId,
      requestId
    });
    return ok(requestId, data);
  }

  @Post("runbooks/:runbookId/execute")
  @RequirePermissions("ops:runbooks:execute")
  async executeRunbook(@Req() req: { headers?: Record<string, unknown> }, @Param("runbookId") runbookId: string) {
    const parsedParams = parseWithSchema(runbookIdParamSchema, { runbookId });
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.opsService.executeRunbook({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      runbookId: parsedParams.runbookId,
      requestId
    });
    return ok(requestId, data);
  }

  @Post("incidents")
  @RequirePermissions("ops:incidents:create")
  async reportIncident(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(opsIncidentSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.opsService.reportIncident({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      severity: parsed.severity ?? "critical",
      title: parsed.title ?? "Manual incident reported from Cortex",
      requestId
    });
    return ok(requestId, data);
  }

  @Post("agent-runtime/:runId/retry")
  @RequirePermissions("ops:dashboard:write")
  async retryAgentRun(@Req() req: { headers?: Record<string, unknown> }, @Param("runId") runId: string) {
    const parsedParams = parseWithSchema(runIdParamSchema, { runId });
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.opsService.retryAgentRun({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      runId: parsedParams.runId,
      requestId
    });
    return ok(requestId, data);
  }

  @Post("agent-runtime/:runId/requeue")
  @RequirePermissions("ops:dashboard:write")
  async requeueAgentRun(@Req() req: { headers?: Record<string, unknown> }, @Param("runId") runId: string) {
    const parsedParams = parseWithSchema(runIdParamSchema, { runId });
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.opsService.requeueAgentRun({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      runId: parsedParams.runId,
      requestId
    });
    return ok(requestId, data);
  }

  @Post("db/dedup")
  @RequirePermissions("ops:dashboard:read")
  async runDedup(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.opsService.runDedup();
    return ok(requestId, result);
  }

  // ── Algorithm Engine Dashboard ─────────────────────────────────────────────

  @Get("algorithm-engine/stats")
  @RequirePermissions("ops:dashboard:read")
  async algorithmEngineStats(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    const stats = await this.algorithmRunService.getStats();
    return ok(requestId, stats);
  }

  @Get("algorithm-engine/runs/:trade")
  @RequirePermissions("ops:dashboard:read")
  async algorithmEngineRunsByTrade(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("trade") trade: string,
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const runs = await this.algorithmRunService.listByTrade(trade, 50);
    return ok(requestId, runs);
  }
}
