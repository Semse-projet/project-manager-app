import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import type { AiGenerateRequest } from "../dto/ai-generate-request.dto.js";
import type { AiGenerateResponse } from "../dto/ai-generate-response.dto.js";
import { requiresPrivateProvider } from "../router/privacy-policy.js";
import { estimateCostUsd } from "./ai-cost.js";
import { parsePricingCatalogMode, type CostResult } from "../pricing/ai-pricing-catalog.js";
import { AiPricingCatalogService } from "../pricing/ai-pricing-catalog.service.js";

export type AiInteractionMode = "runtime" | "report" | "context_only" | "fallback";

export type AiInteractionLog = {
  id: string; timestamp: string; createdAt: string; tenantId?: string; agentId?: string; projectId?: string; userId?: string;
  threadId?: string;
  taskType: string; provider: string; modelSlug: string;
  inputLength: number; outputLength: number; inputTokens?: number; outputTokens?: number;
  latencyMs?: number; routeReason?: string; fallbackUsed: boolean;
  success: boolean; errorMessage?: string; eligibleForTraining: boolean; mode: AiInteractionMode;
};

export type SyntheticAiInteractionInput = {
  tenantId?: string;
  agentId?: string;
  projectId?: string;
  userId?: string;
  threadId?: string;
  taskType: string;
  provider: string;
  modelSlug: string;
  modelName?: string;
  input: string;
  output: string;
  estimatedCostUsd?: number;
  latencyMs?: number;
  routeReason?: string;
  fallbackUsed?: boolean;
  success?: boolean;
  errorMessage?: string;
  eligibleForTraining?: boolean;
  mode?: AiInteractionMode;
};

type GroupedCountRow = {
  _count: { id: number };
} & Record<string, string | { id: number }>;

type PersistedAiInteractionRow = {
  id: string;
  tenantId: string | null;
  agentId: string | null;
  projectId: string | null;
  userId: string | null;
  taskType: string;
  provider: string;
  modelSlug: string;
  modelName: string | null;
  inputLength: number;
  outputLength: number;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: unknown;
  latencyMs: number | null;
  routeReason: string | null;
  fallbackUsed: boolean;
  success: boolean;
  errorMessage: string | null;
  threadId: string | null;
  eligibleForTraining: boolean;
  createdAt: Date;
};

function inferInteractionMode(input: {
  provider: string;
  modelSlug: string;
  fallbackUsed: boolean;
  success: boolean;
  explicitMode?: AiInteractionMode;
}): AiInteractionMode {
  if (input.explicitMode) {
    return input.explicitMode;
  }
  if (input.provider === "semse-context" && input.modelSlug === "prometeo-context-guard") {
    return "context_only";
  }
  if (
    (input.provider === "semse-context" && input.modelSlug === "prometeo-operational-report")
    || (input.provider === "semse-intelligence" && input.modelSlug === "budget-intelligence")
  ) {
    return "report";
  }
  if (input.fallbackUsed || !input.success) {
    return "fallback";
  }
  return "runtime";
}

@Injectable()
export class AiInteractionLoggerService {
  private readonly logger = new Logger(AiInteractionLoggerService.name);
  private readonly buffer: AiInteractionLog[] = [];
  private readonly MAX_BUFFER = 200;

  constructor(
    private readonly prisma: PrismaService,
    // C39 — opcional: sin catálogo (o con AI_PRICING_CATALOG_MODE=off) el comportamiento es el legado.
    @Optional() private readonly pricingCatalog?: AiPricingCatalogService,
  ) {}

  /**
   * C39 — costo según AI_PRICING_CATALOG_MODE (off por defecto):
   *  - off:    comportamiento legado (AI_MODEL_PRICING_JSON), sin tocar nada más.
   *  - shadow: se guarda el valor legado; se calcula el del catálogo y se registra la discrepancia.
   *  - on:     SOLO catálogo. Sin entrada vigente ⇒ costo null + costBasis "unknown"; nunca
   *            hay fallback silencioso al JSON legado (ni a un costo reportado por el proveedor).
   */
  private async resolveCostFields(
    response: AiGenerateResponse,
    at: Date,
  ): Promise<{ estimatedCostUsd?: number; costBasis?: string; priceId?: string }> {
    const legacy = response.estimatedCost
      ?? estimateCostUsd(response.modelSlug, response.inputTokens, response.outputTokens);
    const mode = parsePricingCatalogMode();
    if (mode === "off") return { estimatedCostUsd: legacy };

    const catalog = await this.catalogCost(response, at);
    if (mode === "shadow") {
      if ((legacy ?? null) !== (catalog.costUsd ?? null)) {
        this.logger.warn(JSON.stringify({
          event: "ai_pricing_catalog_mismatch", provider: response.provider, modelSlug: response.modelSlug,
          modelName: response.modelName ?? null, legacyCostUsd: legacy ?? null, catalogCostUsd: catalog.costUsd,
          catalogBasis: catalog.costBasis,
        }));
      }
      return { estimatedCostUsd: legacy };
    }
    if (catalog.costBasis === "unknown") {
      this.logger.warn(JSON.stringify({
        event: "ai_cost_unknown", provider: response.provider, modelSlug: response.modelSlug,
        modelName: response.modelName ?? null, reason: catalog.reason ?? null,
      }));
    }
    return {
      estimatedCostUsd: catalog.costUsd ?? undefined,
      costBasis: catalog.costBasis,
      priceId: catalog.priceId ?? undefined,
    };
  }

  /** Nunca lanza: ante cualquier fallo del catálogo el resultado es unknown (jamás $0 ni precio legado). */
  private async catalogCost(response: AiGenerateResponse, at: Date): Promise<CostResult> {
    const unknown = (reason: string): CostResult => ({ costUsd: null, costBasis: "unknown", priceId: null, reason });
    if (!this.pricingCatalog) return unknown("catalog_unavailable");
    if (!response.modelName) return unknown("no_model_name");
    try {
      return await this.pricingCatalog.resolveCost(
        { provider: response.provider, modelSlug: response.modelSlug, providerModelName: response.modelName },
        at,
        { inputTokens: response.inputTokens, outputTokens: response.outputTokens },
      );
    } catch (err) {
      this.logger.warn(`[ai-cost] catalog lookup failed: ${String(err)}`);
      return unknown("catalog_error");
    }
  }

  async logInteraction(request: AiGenerateRequest, response: AiGenerateResponse): Promise<void> {
    const createdAt = new Date().toISOString();
    const log: AiInteractionLog = {
      id: `ai_log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: createdAt,
      createdAt,
      tenantId: typeof request.metadata?.tenantId === "string" ? request.metadata.tenantId : undefined,
      agentId: request.agentId,
      projectId: request.projectId,
      userId: request.userId,
      threadId: request.threadId,
      taskType: request.taskType,
      provider: response.provider,
      modelSlug: response.modelSlug,
      inputLength: request.input.length,
      outputLength: response.output.length,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      latencyMs: response.latencyMs,
      routeReason: response.routeReason,
      fallbackUsed: response.fallbackUsed ?? false,
      success: response.success,
      errorMessage: response.errorMessage,
      eligibleForTraining: false,
      mode: inferInteractionMode({
        provider: response.provider,
        modelSlug: response.modelSlug,
        fallbackUsed: response.fallbackUsed ?? false,
        success: response.success,
      }),
    };

    const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : undefined);
    const privacyLevel = request.privacyLevel
      ?? (request.privacyCritical ? "privacy_critical" : request.localOnly ? "local_only" : undefined);
    const cost = await this.resolveCostFields(response, new Date(createdAt));
    this.persistInteraction(log, {
      tenantId: request.metadata?.tenantId as string | undefined,
      modelName: response.modelName,
      estimatedCostUsd: cost.estimatedCostUsd,
      costBasis: cost.costBasis,
      priceId: cost.priceId,
      // C39 — who acted and under which privacy policy (server-stamped metadata).
      orgId: str(request.metadata?.orgId),
      actorRoles: str(request.metadata?.actorRoles),
      privacyLevel,
      policyDecision: requiresPrivateProvider(request)
        ? (response.success ? "private_enforced" : "denied")
        : "standard",
    });
  }

  async logSyntheticInteraction(input: SyntheticAiInteractionInput): Promise<void> {
    const createdAt = new Date().toISOString();
    const log: AiInteractionLog = {
      id: `ai_log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: createdAt,
      createdAt,
      tenantId: input.tenantId,
      agentId: input.agentId,
      projectId: input.projectId,
      userId: input.userId,
      threadId: input.threadId,
      taskType: input.taskType,
      provider: input.provider,
      modelSlug: input.modelSlug,
      inputLength: input.input.length,
      outputLength: input.output.length,
      latencyMs: input.latencyMs,
      routeReason: input.routeReason,
      fallbackUsed: input.fallbackUsed ?? false,
      success: input.success ?? true,
      errorMessage: input.errorMessage,
      eligibleForTraining: input.eligibleForTraining ?? false,
      mode: inferInteractionMode({
        provider: input.provider,
        modelSlug: input.modelSlug,
        fallbackUsed: input.fallbackUsed ?? false,
        success: input.success ?? true,
        explicitMode: input.mode,
      }),
    };

    this.persistInteraction(log, {
      tenantId: input.tenantId,
      modelName: input.modelName,
      estimatedCostUsd: input.estimatedCostUsd,
    });
  }

  /**
   * Reads are always tenant-scoped (C10/C39): logs carry prompts' metadata,
   * user/project ids and error messages. Rows without a tenantId (legacy)
   * are never returned to a tenant caller — fail closed.
   */
  getRecentLogs(tenantId: string, limit = 50): AiInteractionLog[] {
    return this.buffer.filter((l) => l.tenantId === tenantId).slice(-limit).reverse();
  }

  async getDbLogs(tenantId: string, limit = 100): Promise<Array<Record<string, unknown>>> {
    const rows = await this.prisma.aiInteractionLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((row: PersistedAiInteractionRow) => this.toLogView(row));
  }

  async getStats(tenantId: string): Promise<Record<string, unknown>> {
    const scope = { tenantId };
    const [total, successes, byModel, byTask, rows] = await Promise.all([
      this.prisma.aiInteractionLog.count({ where: scope }),
      this.prisma.aiInteractionLog.count({ where: { ...scope, success: true } }),
      this.prisma.aiInteractionLog.groupBy({ by: ["modelSlug"], where: scope, _count: { id: true } }),
      this.prisma.aiInteractionLog.groupBy({ by: ["taskType"], where: scope, _count: { id: true } }),
      this.prisma.aiInteractionLog.findMany({
        where: scope,
        select: {
          provider: true,
          modelSlug: true,
          fallbackUsed: true,
          success: true,
        },
      }),
    ]);
    const byMode = rows.reduce<Record<string, number>>((acc: Record<string, number>, row: { provider: string; modelSlug: string; fallbackUsed: boolean; success: boolean }) => {
      const mode = inferInteractionMode({
        provider: row.provider,
        modelSlug: row.modelSlug,
        fallbackUsed: row.fallbackUsed,
        success: row.success,
      });
      acc[mode] = (acc[mode] ?? 0) + 1;
      return acc;
    }, {});
    return {
      total,
      success: successes,
      failureRate: total > 0 ? parseFloat(((total - successes) / total).toFixed(4)) : 0,
      byModel: Object.fromEntries(byModel.map((r: GroupedCountRow) => [String(r.modelSlug), r._count.id])),
      byTask: Object.fromEntries(byTask.map((r: GroupedCountRow) => [String(r.taskType), r._count.id])),
      byMode,
    };
  }

  private persistInteraction(
    log: AiInteractionLog,
    options?: {
      tenantId?: string;
      modelName?: string;
      estimatedCostUsd?: number;
      costBasis?: string;
      priceId?: string;
      orgId?: string;
      actorRoles?: string;
      privacyLevel?: string;
      policyDecision?: string;
    },
  ) {
    this.buffer.push(log);
    if (this.buffer.length > this.MAX_BUFFER) this.buffer.shift();

    void this.prisma.aiInteractionLog.create({
      data: {
        id: log.id,
        tenantId: options?.tenantId ?? log.tenantId,
        agentId: log.agentId,
        projectId: log.projectId,
        userId: log.userId,
        threadId: log.threadId,
        taskType: log.taskType,
        provider: log.provider,
        modelSlug: log.modelSlug,
        modelName: options?.modelName,
        inputLength: log.inputLength,
        outputLength: log.outputLength,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        estimatedCostUsd: options?.estimatedCostUsd,
        costBasis: options?.costBasis,
        priceId: options?.priceId,
        latencyMs: log.latencyMs,
        routeReason: log.routeReason,
        fallbackUsed: log.fallbackUsed,
        success: log.success,
        errorMessage: log.errorMessage,
        eligibleForTraining: log.eligibleForTraining,
        orgId: options?.orgId,
        actorRoles: options?.actorRoles,
        privacyLevel: options?.privacyLevel,
        policyDecision: options?.policyDecision,
      },
    }).catch((err: unknown) => this.logger.warn(`[ai-log] DB persist failed: ${String(err)}`));

    this.logger.log(`[ai-log] task=${log.taskType} mode=${log.mode} model=${log.modelSlug} latency=${log.latencyMs ?? 0}ms success=${log.success}`);
  }

  private toLogView(row: PersistedAiInteractionRow): Record<string, unknown> {
    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      mode: inferInteractionMode({
        provider: row.provider,
        modelSlug: row.modelSlug,
        fallbackUsed: row.fallbackUsed,
        success: row.success,
      }),
    };
  }
}
