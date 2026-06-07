import { randomUUID } from "node:crypto";
import { BadRequestException, Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { AiModelGatewayService } from "./gateway/ai-model-gateway.service.js";
import { AiInteractionLoggerService } from "./logging/ai-interaction-logger.service.js";
import { AiMissionIncidentService, type MissionIncidentInput } from "./logging/ai-mission-incident.service.js";
import { AiModelRouterService } from "./router/ai-model-router.service.js";
import { getEnabledModels, MODEL_REGISTRY } from "./registry/model-registry.js";
import type { AiGenerateRequest } from "./dto/ai-generate-request.dto.js";
import { OperationalContextService } from "./context/operational-context.service.js";
import { PrometeoOrchestratorService } from "./orchestrator/prometeo-orchestrator.service.js";
import { BudgetIntelligenceService } from "../intelligence/budget-intelligence.service.js";
import type { AiTaskType } from "./types/ai-task.types.js";
import { SkillMatcherService } from "../skills/skill-matcher.service.js";
import { buildMemoryContextBlock } from "../skills/context-fencing.js";

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
    const input = (body ?? {}) as Record<string, unknown>;
    const message = typeof input.message === "string" ? input.message.trim() : "";
    if (!message) {
      throw new BadRequestException("message is required");
    }

    const projectId = typeof input.projectId === "string" && input.projectId.trim().length > 0
      ? input.projectId.trim()
      : undefined;
    const agentId = typeof input.agentId === "string" && input.agentId.trim().length > 0
      ? input.agentId.trim()
      : "assistant";
    const threadId = typeof input.threadId === "string" && input.threadId.trim().length > 0
      ? input.threadId.trim()
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

    // Contractor intents don't need the full operational context block
    const contextBlock = this.prometeoOrchestrator.isContractorIntent(intent)
      ? (ctx.activeProject ? `Proyecto activo: "${ctx.activeProject.title}" (${ctx.activeProject.status})` : "")
      : this.operationalContext.formatContextBlock(ctx);

    const NO_PROJECT_REQUIRED: string[] = ["operational_summary", "system_health", "developer_diagnostics", "budget_estimate", "unknown"];
    const noProjectGuardSkipped = NO_PROJECT_REQUIRED.includes(intent) || this.prometeoOrchestrator.isContractorIntent(intent);
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
      return ok(rid, {
        threadId,
        agentId,
        response,
        mode: "context_only",
        route,
        context: ctx,
        timestamp: new Date().toISOString(),
      });
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
      return ok(rid, {
        threadId,
        agentId,
        response,
        mode: "report",
        route,
        context: ctx,
        timestamp: new Date().toISOString(),
      });
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

        return ok(rid, {
          threadId, agentId, response: budgetResponse,
          mode: "report", route, context: ctx, timestamp: new Date().toISOString(),
        });
      }
    }

    // Inject domain skill knowledge relevant to this intent
    const skillContext = this.skillMatcher.buildForIntent(intent, message);
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
      context: contextBlock,
      metadata: {
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        intent,
        primaryAgent: route.primaryAgent,
        skillsInjected: skillContext ? this.skillMatcher.matchForIntent(intent, message).map((m) => m.skill.name) : [],
      },
    };

    const response = await this.gateway.generate(request);
    await this.logger.logInteraction(request, response);

    return ok(rid, {
      threadId,
      agentId,
      response: response.output,
      provider: response.provider,
      model: response.modelName,
      modelSlug: response.modelSlug,
      mode: response.success ? "runtime" : "fallback",
      route,
      context: ctx,
      timestamp: new Date().toISOString(),
      errorMessage: response.errorMessage,
    });
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
