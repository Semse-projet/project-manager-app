import { randomUUID } from "node:crypto";
import { BadRequestException, Body, Controller, Get, Optional, Post, Query, Req } from "@nestjs/common";
import {
  prometeoRequestSchema,
  prometeoResponseSchema,
  type PrometeoCitation,
  type PrometeoMissionState,
  type PrometeoProposedAction,
  type PrometeoRequest,
  type PrometeoResponse,
  type PrometeoResponseBlock,
  type PrometeoToolExecutionResult,
} from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext, type RequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { AiModelGatewayService } from "./gateway/ai-model-gateway.service.js";
import { AiInteractionLoggerService } from "./logging/ai-interaction-logger.service.js";
import { AiMissionIncidentService, type MissionIncidentInput } from "./logging/ai-mission-incident.service.js";
import { AiModelRouterService } from "./router/ai-model-router.service.js";
import { getEnabledModels, MODEL_REGISTRY } from "./registry/model-registry.js";
import type { AiGenerateRequest } from "./dto/ai-generate-request.dto.js";
import { OperationalContextService, type SemseOperationalContext } from "./context/operational-context.service.js";
import {
  PrometeoOrchestratorService,
  type PrometeoRoute,
} from "./orchestrator/prometeo-orchestrator.service.js";
import { BudgetIntelligenceService } from "../intelligence/budget-intelligence.service.js";
import type { AiTaskType } from "./types/ai-task.types.js";
import { SkillMatcherService } from "../skills/skill-matcher.service.js";
import { buildMemoryContextBlock } from "../skills/context-fencing.js";
import { PrometeoToolExecutionService } from "../prometeo/prometeo-tool-execution.service.js";
import { findPrometeoToolDescriptor } from "../prometeo/prometeo-tool-registry.js";

type PrometeoChatMode = "runtime" | "report" | "context_only" | "fallback";

type PrometeoChatEnvelope = PrometeoResponse & {
  threadId: string;
  agentId: string;
  response: string;
  mode: PrometeoChatMode;
  route?: PrometeoRoute;
  context?: SemseOperationalContext;
  timestamp: string;
  provider?: string;
  model?: string;
  modelSlug?: string;
  errorMessage?: string;
};

@Controller("v1/ai-models")
export class AiModelsController {
  constructor(
    private readonly gateway: AiModelGatewayService,
    private readonly router: AiModelRouterService,
    private readonly logger: AiInteractionLoggerService,
    private readonly incidents: AiMissionIncidentService,
    private readonly operationalContext: OperationalContextService,
    private readonly prometeoOrchestrator: PrometeoOrchestratorService,
    private readonly budgetIntelligence: BudgetIntelligenceService,
    private readonly skillMatcher: SkillMatcherService,
    @Optional() private readonly prometeoTools?: PrometeoToolExecutionService,
  ) {}

  @Get("registry")
  @RequirePermissions("agents:run:create")
  getRegistry(@Req() req: { headers?: Record<string, unknown> }) {
    return ok(resolveRequestId(req.headers ?? {}), MODEL_REGISTRY);
  }

  @Get()
  @RequirePermissions("agents:run:create")
  listEnabled(@Req() req: { headers?: Record<string, unknown> }) {
    return ok(resolveRequestId(req.headers ?? {}), getEnabledModels());
  }

  @Get("readiness")
  @RequirePermissions("agents:run:create")
  getReadiness(@Req() req: { headers?: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const routeSamples = (
      [
        "general_chat",
        "document_summary",
        "project_planning",
        "risk_analysis",
        "construction_contract_analysis",
        "architecture_review",
        "rag_answer",
      ] as AiTaskType[]
    ).map((taskType) => ({
      taskType,
      route: this.router.selectRoute({
        taskType,
        input: `diagnostic:${taskType}`,
      }),
    }));

    const registeredProviders = this.gateway.getRuntimeProviders();
    return ok(rid, {
      generatedAt: new Date().toISOString(),
      llmOrchestrator: {
        hasProvider: this.gateway.hasRuntimeProvider(),
        providers: registeredProviders,
      },
      environment: {
        anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
        openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
        deepseekConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
        kimiConfigured: Boolean(process.env.KIMI_API_KEY),
        openSourceEnabled: process.env.ENABLE_OPEN_SOURCE_MODELS === "true",
      },
      models: MODEL_REGISTRY.map((model) => ({
        slug: model.slug,
        displayName: model.displayName,
        modelName: model.modelName,
        provider: model.provider,
        providerMode: model.providerMode,
        enabled: model.enabled,
        bestFor: model.bestFor,
        supportsStreaming: model.supportsStreaming ?? false,
        supportsToolUse: model.supportsToolUse ?? false,
      })),
      routeSamples,
    });
  }

  @Post("generate")
  @RequirePermissions("agents:run:create")
  async generate(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    const request = {
      ...(body as Record<string, unknown>),
      userId: (body as Record<string, unknown>).userId ?? actor.userId,
    } as AiGenerateRequest;
    const response = await this.gateway.generate(request);
    await this.logger.logInteraction(request, response);
    return ok(rid, response);
  }

  @Post("route")
  @RequirePermissions("agents:run:create")
  selectRoute(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const rid = resolveRequestId(req.headers ?? {});
    return ok(rid, this.router.selectRoute(body as AiGenerateRequest));
  }

  @Get("logs")
  @RequirePermissions("agents:run:create")
  async getLogs(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("limit") limit?: string,
    @Query("source") source?: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const data = source === "buffer"
      ? this.logger.getRecentLogs(parsedLimit)
      : await this.logger.getDbLogs(parsedLimit);
    return ok(rid, data);
  }

  @Get("logs/stats")
  @RequirePermissions("agents:run:create")
  async getStats(@Req() req: { headers?: Record<string, unknown> }) {
    return ok(resolveRequestId(req.headers ?? {}), await this.logger.getStats());
  }

  @Get("logs/db")
  @RequirePermissions("agents:run:create")
  async getDbLogs(@Req() req: { headers?: Record<string, unknown> }, @Query("limit") limit?: string) {
    const rid = resolveRequestId(req.headers ?? {});
    return ok(rid, await this.logger.getDbLogs(limit ? parseInt(limit, 10) : 100));
  }

  @Get("operational-context")
  @RequirePermissions("agents:run:create")
  async getOperationalContext(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("projectId") projectId?: string,
  ) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = await this.operationalContext.buildContext({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      role: actor.roles[0] ?? "CLIENT",
      projectId,
    });
    return ok(rid, ctx);
  }

  @Get("operational-context/latest")
  @RequirePermissions("agents:run:create")
  async getLatestOperationalContext(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("projectId") projectId?: string,
  ) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = await this.operationalContext.getLatestSnapshot({
      tenantId: actor.tenantId,
      userId: actor.userId,
      projectId,
    });
    return ok(rid, ctx);
  }

  @Post("prometeo/chat")
  @RequirePermissions("agents:run:create")
  async prometeoChat(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    const runtimeRequest = this.parsePrometeoRequest(body);
    const message = runtimeRequest.message?.trim() || this.buildMessageFromPrometeoRequest(runtimeRequest);

    const projectId = this.resolvePrometeoProjectId(runtimeRequest);
    const agentId = typeof runtimeRequest.agentId === "string" && runtimeRequest.agentId.trim().length > 0
      ? runtimeRequest.agentId.trim()
      : "assistant";
    const threadId = typeof runtimeRequest.threadId === "string" && runtimeRequest.threadId.trim().length > 0
      ? runtimeRequest.threadId.trim()
      : randomUUID();

    const ctx = await this.operationalContext.buildContext({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      role: actor.roles[0] ?? "CLIENT",
      projectId,
    });
    const intent = this.prometeoOrchestrator.classifyIntent(message);
    const route = this.prometeoOrchestrator.routeToAgent(intent, agentId);
    const taskType = this.prometeoOrchestrator.mapIntentToTaskType(intent);
    const executionResults = await this.resolvePrometeoReadToolExecution(actor, rid, runtimeRequest);

    // Contractor intents don't need the full operational context block
    const contextBlock = this.prometeoOrchestrator.isContractorIntent(intent)
      ? (ctx.activeProject ? `Proyecto activo: "${ctx.activeProject.title}" (${ctx.activeProject.status})` : "")
      : this.operationalContext.formatContextBlock(ctx);
    const requestContextBlock = this.formatPrometeoRequestContext(runtimeRequest);
    const fullContextBlock = [contextBlock, requestContextBlock].filter(Boolean).join("\n\n");

    const NO_PROJECT_REQUIRED: string[] = ["operational_summary", "system_health", "developer_diagnostics", "budget_estimate", "unknown"];
    const noProjectGuardSkipped = NO_PROJECT_REQUIRED.includes(intent)
      || this.prometeoOrchestrator.isContractorIntent(intent)
      || runtimeRequest.attachments.length > 0
      || runtimeRequest.selectedEntities.length > 0
      || Boolean(runtimeRequest.requestedAction);
    if (!ctx.activeProject && !noProjectGuardSkipped) {
      const response = this.prometeoOrchestrator.buildNoProjectSelectedResponse(ctx, route);
      await this.logger.logSyntheticInteraction({
        tenantId: actor.tenantId,
        agentId,
        projectId,
        userId: actor.userId,
        taskType,
        provider: "semse-context",
        modelSlug: "prometeo-context-guard",
        modelName: "Prometeo Context Guard",
        input: message,
        output: response,
        routeReason: `${route.primaryAgent}: no_project_selected`,
        mode: "context_only",
      });
      return ok(rid, this.buildPrometeoChatEnvelope({
        threadId,
        agentId,
        mode: "context_only",
        response,
        route,
        ctx,
        runtimeRequest,
        executionResults,
      }));
    }

    if (intent === "operational_summary") {
      const response = this.prometeoOrchestrator.buildOperationalReport(ctx);
      await this.logger.logSyntheticInteraction({
        tenantId: actor.tenantId,
        agentId,
        projectId: ctx.activeProject?.id ?? projectId,
        userId: actor.userId,
        taskType,
        provider: "semse-context",
        modelSlug: "prometeo-operational-report",
        modelName: "Prometeo Operational Report",
        input: message,
        output: response,
        routeReason: `${route.primaryAgent}: operational_report`,
        mode: "report",
      });
      return ok(rid, this.buildPrometeoChatEnvelope({
        threadId,
        agentId,
        mode: "report",
        response,
        route,
        ctx,
        runtimeRequest,
        executionResults,
      }));
    }

    if (intent === "budget_estimate") {
      const suggestion = await this.budgetIntelligence.suggestBudget({
        tenantId: actor.tenantId,
        userId: actor.userId,
        title: message.slice(0, 200),
        scope: message,
      }).catch(() => null);

      if (suggestion) {
        const budgetResponse = suggestion.min > 0
          ? `**Estimación de presupuesto**\n\nRango: $${suggestion.min.toLocaleString()} – $${suggestion.max.toLocaleString()} MXN\nMediana del mercado: $${suggestion.median.toLocaleString()} MXN\nConfianza: ${suggestion.confidence.toUpperCase()}\n\n${suggestion.aiNarrative}\n\n*Basado en ${suggestion.similarJobsFound} trabajos similares en el historial.*`
          : suggestion.aiNarrative;

        await this.logger.logSyntheticInteraction({
          tenantId: actor.tenantId, agentId, userId: actor.userId, taskType,
          provider: "semse-intelligence", modelSlug: "budget-intelligence",
          modelName: "SEMSE Budget Intelligence", input: message, output: budgetResponse,
          routeReason: `${route.primaryAgent}: budget_estimate confidence=${suggestion.confidence}`,
          mode: "report",
        });

        return ok(rid, this.buildPrometeoChatEnvelope({
          threadId,
          agentId,
          response: budgetResponse,
          mode: "report",
          route,
          ctx,
          runtimeRequest,
          executionResults,
        }));
      }
    }

    // Inject domain skill knowledge relevant to this intent
    const skillContext = this.skillMatcher?.buildForIntent(intent, message);
    const baseSystemPrompt = this.prometeoOrchestrator.buildSystemPrompt(agentId, ctx, route);
    const systemPromptWithSkills = skillContext
      ? `${baseSystemPrompt}\n\n${buildMemoryContextBlock(skillContext)}`
      : baseSystemPrompt;

    const request: AiGenerateRequest = {
      agentId,
      projectId: ctx.activeProject?.id ?? projectId,
      userId: actor.userId,
      threadId,
      taskType,
      input: message,
      systemPrompt: systemPromptWithSkills,
      context: fullContextBlock,
      metadata: {
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        intent,
        primaryAgent: route.primaryAgent,
        requestKind: runtimeRequest.attachments.length > 0 || runtimeRequest.requestedAction ? "prometeo_multimodal_request" : "prometeo_text_chat",
        attachmentCount: runtimeRequest.attachments.length,
        selectedEntityCount: runtimeRequest.selectedEntities.length,
        requestedAction: runtimeRequest.requestedAction,
        missionId: runtimeRequest.missionId,
        pageRoute: runtimeRequest.pageContext?.route,
        skillsInjected: skillContext && this.skillMatcher ? this.skillMatcher.matchForIntent(intent, message).map((m) => m.skill.name) : [],
      },
    };

    const response = await this.gateway.generate(request);
    await this.logger.logInteraction(request, response);

    return ok(rid, this.buildPrometeoChatEnvelope({
      threadId,
      agentId,
      provider: response.provider,
      model: response.modelName,
      modelSlug: response.modelSlug,
      mode: response.success ? "runtime" : "fallback",
      response: response.output,
      route,
      ctx,
      runtimeRequest,
      executionResults,
      errorMessage: response.errorMessage,
    }));
  }

  private async resolvePrometeoReadToolExecution(
    actor: RequestContext,
    requestId: string,
    request: PrometeoRequest,
  ): Promise<PrometeoToolExecutionResult[]> {
    if (!request.requestedAction || !this.prometeoTools) return [];
    const [namespace, name] = this.splitRequestedAction(request.requestedAction);
    const descriptor = findPrometeoToolDescriptor(namespace, name);
    if (!descriptor || descriptor.mode !== "read") return [];

    try {
      const result = await this.prometeoTools.invokeReadTool(actor, requestId, {
        namespace,
        name,
        input: this.resolveRequestedActionInput(request),
        threadId: request.threadId,
        missionId: request.missionId,
      });
      return [result];
    } catch (error) {
      const message = error instanceof Error ? error.message : "Prometeo tool execution failed";
      const now = new Date().toISOString();
      return [{
        id: `exec_${randomUUID()}`,
        namespace,
        tool: name,
        status: "failed",
        errorMessage: message,
        auditRef: `prometeo-tool:${requestId}:failed`,
        startedAt: now,
        completedAt: now,
      }];
    }
  }

  private splitRequestedAction(requestedAction: string): [string, string] {
    const [namespace = "prometeo", name = "resolve_action"] = requestedAction.split(".");
    return [namespace.trim() || "prometeo", name.trim() || "resolve_action"];
  }

  private resolveRequestedActionInput(request: PrometeoRequest): Record<string, unknown> {
    if (request.requestedActionInput) return request.requestedActionInput;
    if (typeof request.context === "object" && request.context !== null) {
      const context = request.context as Record<string, unknown>;
      const actionInput = context.actionInput ?? context.toolInput;
      if (typeof actionInput === "object" && actionInput !== null && !Array.isArray(actionInput)) {
        return actionInput as Record<string, unknown>;
      }
    }
    return {};
  }

  private parsePrometeoRequest(body: unknown): PrometeoRequest {
    const parsed = prometeoRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private resolvePrometeoProjectId(request: PrometeoRequest): string | undefined {
    if (request.projectId) return request.projectId;
    return request.selectedEntities.find((entity) => entity.type === "project")?.id;
  }

  private buildMessageFromPrometeoRequest(request: PrometeoRequest): string {
    if (request.requestedAction) {
      return `Prepara la acción solicitada: ${request.requestedAction}`;
    }
    const attachmentTypes = request.attachments.map((attachment) => attachment.type).join(", ");
    return `Analiza los adjuntos recibidos${attachmentTypes ? ` (${attachmentTypes})` : ""}.`;
  }

  private formatPrometeoRequestContext(request: PrometeoRequest): string {
    const lines: string[] = [];

    if (request.pageContext) {
      lines.push("## Prometeo request context");
      if (request.pageContext.route) lines.push(`- Ruta UI: ${request.pageContext.route}`);
      if (request.pageContext.module) lines.push(`- Módulo UI: ${request.pageContext.module}`);
      if (request.pageContext.title) lines.push(`- Vista: ${request.pageContext.title}`);
    }

    if (request.selectedEntities.length > 0) {
      if (lines.length === 0) lines.push("## Prometeo request context");
      lines.push("- Entidades seleccionadas:");
      for (const entity of request.selectedEntities) {
        lines.push(`  - ${entity.type}:${entity.id}${entity.label ? ` (${entity.label})` : ""}`);
      }
    }

    if (request.attachments.length > 0) {
      if (lines.length === 0) lines.push("## Prometeo request context");
      lines.push("- Adjuntos:");
      for (const attachment of request.attachments) {
        const name = attachment.name ? ` ${attachment.name}` : "";
        const mime = attachment.mimeType ? ` ${attachment.mimeType}` : "";
        lines.push(`  - ${attachment.type}${name}${mime}`);
      }
    }

    if (request.requestedAction) {
      if (lines.length === 0) lines.push("## Prometeo request context");
      lines.push(`- Acción solicitada: ${request.requestedAction}`);
      if (request.requestedActionInput && Object.keys(request.requestedActionInput).length > 0) {
        lines.push(`- Input de acción: ${JSON.stringify(request.requestedActionInput)}`);
      }
    }

    return lines.join("\n");
  }

  private buildPrometeoChatEnvelope(input: {
    threadId: string;
    agentId: string;
    response: string;
    mode: PrometeoChatMode;
    route: PrometeoRoute;
    ctx: SemseOperationalContext;
    runtimeRequest: PrometeoRequest;
    provider?: string;
    model?: string;
    modelSlug?: string;
    errorMessage?: string;
    executionResults?: PrometeoToolExecutionResult[];
  }): PrometeoChatEnvelope {
    const executionResults = input.executionResults ?? [];
    const proposedActions = this.buildProposedActions(input.runtimeRequest, input.route);
    const mission = this.buildMissionState({
      threadId: input.threadId,
      mode: input.mode,
      route: input.route,
      request: input.runtimeRequest,
      proposedActions,
      executionResults,
    });
    const structured = prometeoResponseSchema.parse({
      message: input.response,
      blocks: this.buildResponseBlocks({
        mode: input.mode,
        route: input.route,
        ctx: input.ctx,
        request: input.runtimeRequest,
        proposedActions,
        executionResults,
        mission,
      }),
      proposedActions,
      executionResults,
      mission,
      citations: this.buildCitations(input.ctx),
      refreshTargets: this.buildRefreshTargets(input.route, input.ctx, input.runtimeRequest),
    });

    return {
      ...structured,
      threadId: input.threadId,
      agentId: input.agentId,
      response: structured.message,
      mode: input.mode,
      route: input.route,
      context: input.ctx,
      timestamp: new Date().toISOString(),
      provider: input.provider,
      model: input.model,
      modelSlug: input.modelSlug,
      errorMessage: input.errorMessage,
    };
  }

  private buildResponseBlocks(input: {
    mode: PrometeoChatMode;
    route: PrometeoRoute;
    ctx: SemseOperationalContext;
    request: PrometeoRequest;
    proposedActions: PrometeoProposedAction[];
    executionResults: PrometeoToolExecutionResult[];
    mission: PrometeoMissionState;
  }): PrometeoResponseBlock[] {
    const blocks: PrometeoResponseBlock[] = [
      {
        id: "route",
        type: "agent_route",
        title: "Ruta de Prometeo",
        status: "completed",
        payload: {
          intent: input.route.intent,
          primaryAgent: input.route.primaryAgent,
          supportingAgents: input.route.supportingAgents,
          selectionSource: input.route.selectionSource,
          mode: input.mode,
        },
      },
      {
        id: "context",
        type: "context_chips",
        title: "Contexto activo",
        status: "completed",
        payload: {
          mode: input.ctx.mode,
          project: input.ctx.activeProject,
          selectedEntities: input.request.selectedEntities,
          pageContext: input.request.pageContext,
        },
      },
      {
        id: "mission",
        type: "mission_status",
        title: "Estado de misión",
        status: input.mission.status === "completed" ? "completed" : "pending",
        payload: input.mission,
      },
    ];

    if (input.request.attachments.length > 0) {
      blocks.push({
        id: "attachments",
        type: "attachment_summary",
        title: "Adjuntos recibidos",
        status: "pending",
        summary: "Prometeo recibió el envelope multimodal; el análisis binario se ejecutará cuando el pipeline de adjuntos esté conectado.",
        payload: {
          count: input.request.attachments.length,
          attachments: input.request.attachments.map((attachment) => ({
            id: attachment.id ?? attachment.fileId ?? attachment.evidenceId ?? null,
            type: attachment.type,
            source: attachment.source,
            name: attachment.name ?? null,
            mimeType: attachment.mimeType ?? null,
            sizeBytes: attachment.sizeBytes ?? null,
          })),
        },
      });
    }

    if (input.proposedActions.length > 0) {
      blocks.push({
        id: "proposed-actions",
        type: "proposed_actions",
        title: "Acciones propuestas",
        status: input.proposedActions.some((action) => action.requiresApproval) ? "pending" : "info",
        payload: { actions: input.proposedActions },
      });
    }

    if (input.executionResults.length > 0) {
      const hasFailed = input.executionResults.some((result) => result.status === "failed");
      const hasBlocked = input.executionResults.some((result) => result.status === "blocked");
      blocks.push({
        id: "tool-results",
        type: "tool_execution_results",
        title: "Resultados de herramientas",
        status: hasFailed ? "failed" : hasBlocked ? "blocked" : "completed",
        payload: { results: input.executionResults },
      });
    }

    if (input.mode === "report" && input.ctx.ecosystem5d) {
      blocks.push({
        id: "ecosystem5d",
        type: "operational_snapshot",
        title: "Ecosistema 5D",
        status: "completed",
        payload: input.ctx.ecosystem5d,
      });
    }

    return blocks;
  }

  private buildProposedActions(request: PrometeoRequest, route: PrometeoRoute): PrometeoProposedAction[] {
    const actions: PrometeoProposedAction[] = [];
    const seen = new Set<string>();
    const pushAction = (action: PrometeoProposedAction) => {
      const key = `${action.namespace}.${action.tool}`;
      if (seen.has(key)) return;
      seen.add(key);
      actions.push(action);
    };

    if (request.requestedAction) {
      const [namespace, tool] = this.splitRequestedAction(request.requestedAction);
      const critical = namespace === "payments" || request.requestedAction.includes("release");
      const descriptor = findPrometeoToolDescriptor(namespace, tool);
      const readOnly = descriptor?.mode === "read" || tool.startsWith("get") || tool.startsWith("list") || tool.startsWith("search");
      pushAction({
        id: `act-${namespace}-${tool}`,
        namespace,
        tool,
        label: request.requestedAction,
        description: readOnly
          ? "Acción de lectura solicitada por el usuario; Prometeo puede ejecutarla desde el Tool Registry P1."
          : "Acción solicitada por el usuario; Prometeo la propone y conserva aprobación antes de mutaciones.",
        riskLevel: critical ? "critical" : readOnly ? "low" : "medium",
        approvalPolicy: critical ? "human_required" : readOnly ? "none" : "confirm",
        requiresApproval: !readOnly,
        status: critical ? "awaiting_approval" : "proposed",
        input: { selectedEntities: request.selectedEntities },
        reason: "requestedAction",
      });
    }

    if (request.attachments.some((attachment) => attachment.type === "image")) {
      pushAction({
        id: "act-vision-analyze-image",
        namespace: "vision",
        tool: "analyze_image",
        label: "Analizar imagen",
        description: "Preparar análisis visual de imágenes adjuntas o evidencia existente.",
        riskLevel: "low",
        approvalPolicy: "none",
        requiresApproval: false,
        status: "proposed",
        input: { attachments: request.attachments.filter((attachment) => attachment.type === "image") },
        reason: "image_attachment",
      });
    }

    if (request.attachments.some((attachment) => attachment.type === "video")) {
      pushAction({
        id: "act-vision-analyze-video",
        namespace: "vision",
        tool: "analyze_video",
        label: "Analizar video",
        description: "Preparar job de video intelligence con extracción de fotogramas y timeline cuando el pipeline esté conectado.",
        riskLevel: "low",
        approvalPolicy: "none",
        requiresApproval: false,
        status: "blocked",
        input: { attachments: request.attachments.filter((attachment) => attachment.type === "video") },
        reason: "video_pipeline_pending",
      });
    }

    const lowerMessage = request.message?.toLowerCase() ?? "";
    if ((route.intent === "payment_status" || lowerMessage.includes("liberar") || lowerMessage.includes("release")) && lowerMessage.includes("pago")) {
      pushAction({
        id: "act-payments-propose-release",
        namespace: "payments",
        tool: "propose_release",
        label: "Proponer liberación de pago",
        description: "Prometeo puede preparar la recomendación, pero no liberar fondos sin aprobación humana.",
        riskLevel: "critical",
        approvalPolicy: "human_required",
        requiresApproval: true,
        status: "awaiting_approval",
        input: { selectedEntities: request.selectedEntities },
        reason: "payment_governance",
      });
    }

    return actions;
  }

  private buildMissionState(input: {
    threadId: string;
    mode: PrometeoChatMode;
    route: PrometeoRoute;
    request: PrometeoRequest;
    proposedActions: PrometeoProposedAction[];
    executionResults: PrometeoToolExecutionResult[];
  }): PrometeoMissionState {
    const pendingApprovals = input.proposedActions
      .filter((action) => action.requiresApproval)
      .map((action) => action.id);
    const blockedActions = input.proposedActions.some((action) => action.status === "blocked");
    const failedExecution = input.executionResults.some((result) => result.status === "failed");
    const blockedExecution = input.executionResults.some((result) => result.status === "blocked");
    const status: PrometeoMissionState["status"] = input.mode === "fallback"
      ? "failed"
      : failedExecution
      ? "failed"
      : pendingApprovals.length > 0
      ? "waiting_approval"
      : input.mode === "context_only" || blockedActions || blockedExecution
      ? "waiting_input"
      : "completed";
    const executionStepStatus: PrometeoMissionState["steps"][number]["status"] = failedExecution
      ? "failed"
      : blockedExecution
      ? "blocked"
      : input.executionResults.length > 0
      ? "completed"
      : "skipped";

    return {
      id: input.request.missionId ?? `mis-${input.threadId}`,
      status,
      phase: status === "completed" ? "completed" : status === "waiting_approval" ? "approval" : "planning",
      goal: input.request.requestedAction ?? (input.request.message?.trim() || "Prometeo request"),
      durable: false,
      pendingApprovals,
      steps: [
        { id: "observe", label: "Observar entrada y contexto", status: "completed" },
        { id: "interpret", label: `Resolver intención: ${input.route.intent}`, status: "completed" },
        {
          id: "plan",
          label: "Preparar respuesta y acciones",
          status: input.proposedActions.length > 0 ? "completed" : "skipped",
        },
        {
          id: "approval",
          label: "Resolver aprobaciones",
          status: pendingApprovals.length > 0 ? "pending" : "skipped",
        },
        {
          id: "execute",
          label: "Ejecutar herramientas",
          status: executionStepStatus,
          detail: input.executionResults.length > 0
            ? "Prometeo ejecutó tools de lectura desde el Tool Registry P1."
            : "Las mutaciones siguen como acciones propuestas; solo las tools de lectura explícitas se ejecutan en P1.",
        },
      ],
    };
  }

  private buildCitations(ctx: SemseOperationalContext): PrometeoCitation[] {
    return [
      {
        id: `operational-context-${ctx.generatedAt}`,
        type: "system",
        label: "Prometeo Operational Context",
        excerpt: ctx.activeProject
          ? `Proyecto activo: ${ctx.activeProject.title} (${ctx.activeProject.status})`
          : "Snapshot operativo sin proyecto activo.",
        metadata: { generatedAt: ctx.generatedAt, mode: ctx.mode },
      },
    ];
  }

  private buildRefreshTargets(route: PrometeoRoute, ctx: SemseOperationalContext, request: PrometeoRequest): string[] {
    const targets = new Set<string>(["prometeo.chat", "prometeo.context"]);
    if (ctx.activeProject) targets.add(`project:${ctx.activeProject.id}`);
    for (const entity of request.selectedEntities) targets.add(`${entity.type}:${entity.id}`);
    if (request.attachments.some((attachment) => attachment.type === "image" || attachment.type === "video")) {
      targets.add("vision.evidence");
    }
    if (route.intent === "payment_status" || route.intent === "dispute_status") targets.add("payments.disputes");
    if (request.requestedAction?.startsWith("time_tracker.")) targets.add("time_tracker");
    if (request.requestedAction?.startsWith("agro.")) targets.add("agro");
    return [...targets];
  }

  @Post("incidents")
  @RequirePermissions("agents:run")
  async persistIncident(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req.headers ?? {});
    const input = body as MissionIncidentInput;
    const incident = await this.incidents.persist({ ...input, tenantId: input.tenantId ?? ctx.tenantId });
    return ok(rid, incident);
  }

  @Get("incidents")
  @RequirePermissions("agents:run")
  async getIncidents(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("limit") limit?: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req.headers ?? {});
    const data = await this.incidents.getRecent(ctx.tenantId, limit ? parseInt(limit, 10) : 20);
    return ok(rid, data);
  }
}
