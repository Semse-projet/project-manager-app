import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
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
import { Optional } from "@nestjs/common";
import type { PrometeoService } from "../prometeo/prometeo.service.js";
import { ConsciousnessIndexService } from "./consciousness.service.js";
import { SystemObserverService } from "./observer.service.js";
import { RecommendationEngineService } from "./recommendation-engine.service.js";
import { SimulationEngineService } from "./simulation-engine.service.js";
import { ApplyEngineService } from "./apply-engine.service.js";

@Controller("v1/ops")
export class OpsController {
  constructor(
    private readonly opsService: OpsService,
    private readonly llmOrchestrator: LLMOrchestrator,
    private readonly algorithmRunService: AlgorithmRunService,
    private readonly consciousness: ConsciousnessIndexService,
    private readonly observer: SystemObserverService,
    private readonly recommendationEngine: RecommendationEngineService,
    private readonly simulationEngine: SimulationEngineService,
    private readonly applyEngine: ApplyEngineService,
    @Optional() private readonly prometeoService?: PrometeoService,
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

  @Get("ai-mission-control/ollama/health")
  @RequirePermissions("ops:dashboard:read")
  async getOllamaHealth(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ollama = this.llmOrchestrator.getOllamaProvider();

    if (!ollama) {
      return ok(requestId, { registered: false, message: "Ollama provider not registered (check LLM_DEFAULT_PROVIDER and ENABLE_OPEN_SOURCE_MODELS)" });
    }

    const config = ollama.getConfig();
    const t0 = Date.now();
    const health = await ollama.modelHealthCheck();
    const latencyMs = Date.now() - t0;

    return ok(requestId, {
      registered: true,
      serverOk: health.serverOk,
      modelLoaded: health.modelLoaded,
      availableModels: health.availableModels,
      configuredModel: config.model,
      baseUrl: config.baseUrl.replace(/\/\/[^@]*@/, "//***@"), // mask credentials
      isRemote: config.isRemote,
      hasApiKey: config.hasApiKey,
      timeoutMs: config.timeoutMs,
      healthCheckLatencyMs: latencyMs,
      localOnlySafe: true,
      checkedAt: new Date().toISOString(),
    });
  }

  @Post("ai-mission-control/ollama/test")
  @RequirePermissions("ops:dashboard:write")
  async testOllama(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ollama = this.llmOrchestrator.getOllamaProvider();

    if (!ollama) {
      return ok(requestId, { success: false, error: "Ollama not registered" });
    }

    const t0 = Date.now();
    try {
      const res = await this.llmOrchestrator.chat({
        systemPrompt: "You are a SEMSE OS health check assistant.",
        history: [],
        userMessage: "Respond with only: {\"status\":\"ok\",\"provider\":\"ollama\"}",
        context: { localOnly: true, source: "ai-mission-control:test", routingReason: "admin-test" },
      });
      return ok(requestId, {
        success: true,
        provider: res.provider,
        model: res.model,
        latencyMs: Date.now() - t0,
        fallbackUsed: res.metadata.fallbackUsed,
        responsePreview: res.text.slice(0, 100),
      });
    } catch (err) {
      return ok(requestId, {
        success: false,
        latencyMs: Date.now() - t0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Backfill zero-vector chunks with real embeddings (idempotent) */
  @Post("ai-mission-control/backfill-embeddings")
  @RequirePermissions("ops:dashboard:write")
  async backfillEmbeddings(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);

    if (!this.prometeoService) {
      return ok(requestId, { error: "PrometeoService not available" });
    }

    const result = await this.prometeoService.backfillEmbeddings({
      tenantId:  ctx.tenantId,
      batchSize: typeof body.batchSize === "number" ? body.batchSize : 16,
      dryRun:    body.dryRun === true,
    });

    return ok(requestId, result);
  }

  /** Prometeo RAG + Embeddings health for Mission Control */
  @Get("ai-mission-control/rag")
  @RequirePermissions("ops:dashboard:read")
  async getRagHealth(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);

    if (!this.prometeoService) {
      return ok(requestId, {
        embeddingsProvider: "none",
        embeddingsAvailable: false,
        embeddingsHealthy: false,
        totalDocuments: 0,
        totalChunks: 0,
        chunksWithEmbeddings: 0,
        chunksMissingEmbeddings: 0,
        retrievalMode: "fts_fallback",
        error: "PrometeoService not available",
      });
    }

    try {
      const health = await this.prometeoService.getEmbeddingRagHealth(ctx.tenantId);
      return ok(requestId, health);
    } catch (err) {
      return ok(requestId, {
        embeddingsProvider: "unknown",
        embeddingsAvailable: false,
        embeddingsHealthy: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
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

  // ── SEMSE Consciousness — espejo interno del ecosistema ─────────────────────

  /** Índice vivo del ecosistema: identidad, madurez, riesgos, recomendaciones. */
  @Get("consciousness/index")
  @RequirePermissions("ops:dashboard:read")
  async getConsciousnessIndex(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const index = await this.consciousness.buildIndex(ctx.tenantId);
    return ok(requestId, index);
  }

  /** Pregunta al sistema sobre sí mismo — diagnóstico en lenguaje natural. */
  @Post("consciousness/query")
  @RequirePermissions("ops:dashboard:read")
  async queryConsciousness(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) return ok(requestId, { error: "question required" });

    const result = await this.consciousness.queryConsciousness(question, ctx.tenantId);
    return ok(requestId, result);
  }

  // ── SEMSE Internal Observer — observación automática del ecosistema ─────────

  /** Snapshot de observación en tiempo real — lee infra, señales, LLM, RAG. */
  @Get("observer/snapshot")
  @RequirePermissions("ops:dashboard:read")
  async observerSnapshot(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const snapshot = await this.observer.observe(ctx.tenantId);
    return ok(requestId, snapshot);
  }

  /** Último snapshot cacheado en memoria (sin hacer nueva observación). */
  @Get("observer/latest")
  @RequirePermissions("ops:dashboard:read")
  async observerLatest(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const latest = this.observer.getLatest();
    if (!latest || latest.tenantId !== ctx.tenantId) {
      // No cached snapshot — trigger one
      const snapshot = await this.observer.observe(ctx.tenantId);
      return ok(requestId, { ...snapshot, fromCache: false });
    }
    return ok(requestId, { ...latest, fromCache: true });
  }

  /** Historial de snapshots en memoria (últimos 50). */
  @Get("observer/history")
  @RequirePermissions("ops:dashboard:read")
  async observerHistory(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    const history = this.observer.getHistory();
    return ok(requestId, {
      count: history.length,
      snapshots: history.slice(-10).map((s) => ({
        observedAt: s.observedAt,
        healthScore: s.healthScore,
        alerts: s.alerts.length,
        criticalSignals: s.operationalHealth.criticalSignals,
        ragMode: s.intelligenceHealth.embeddingsMode,
      })),
    });
  }

  // ── Worker metrics ────────────────────────────────────────────────────────────

  /** Métricas de la cola BullMQ del worker — jobs waiting/active/completed/failed. */
  @Get("worker/metrics")
  @RequirePermissions("ops:dashboard:read")
  async getWorkerMetrics(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    const metrics = await this.opsService.getWorkerQueueMetrics();
    return ok(requestId, metrics);
  }

  // ── Autonomy Level 2 — Recommendation Engine ────────────────────────────────

  /** Genera recomendaciones estructuradas con PR draft. Solo propone — no modifica. */
  @Get("recommendations")
  @RequirePermissions("ops:dashboard:read")
  async getRecommendations(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const report = await this.recommendationEngine.generate(ctx.tenantId);
    return ok(requestId, report);
  }

  // ── Autonomy Level 3 — Simulation Engine ────────────────────────────────────

  /** Simula patches para las top recomendaciones. Lee, no aplica. */
  @Get("simulation")
  @RequirePermissions("ops:dashboard:read")
  async getSimulation(@Req() req: { headers?: Record<string, unknown> }, @Query("limit") limit?: string) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const report = await this.simulationEngine.simulate(ctx.tenantId, limit ? parseInt(limit, 10) : 5);
    return ok(requestId, report);
  }

  /** Simula el patch para una recomendación específica. */
  @Get("simulation/:recId")
  @RequirePermissions("ops:dashboard:read")
  async simulateOne(@Req() req: { headers?: Record<string, unknown> }, @Param("recId") recId: string) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const patch = await this.simulationEngine.simulateOne(ctx.tenantId, recId);
    if (!patch) return ok(requestId, null);
    return ok(requestId, patch);
  }

  // ── Autonomy Level 4 — Apply Engine ─────────────────────────────────────────

  /**
   * Aplica un patch safeToApply=true con confirmación humana explícita.
   * Requiere: confirmed=true en el body Y SEMSE_ALLOW_AUTONOMOUS_APPLY=true en env.
   * Crea archivos nuevos únicamente — nunca sobreescribe ni modifica código de producción.
   */
  @Post("apply/:recId")
  @RequirePermissions("ops:dashboard:write")
  async applyPatch(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("recId") recId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const confirmed = body.confirmed === true;

    const result = await this.applyEngine.apply({
      tenantId:  ctx.tenantId,
      recId,
      actorId:   ctx.userId,
      confirmed,
    });

    return ok(requestId, result);
  }
}
