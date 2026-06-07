import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import type { AiGenerateRequest } from "../dto/ai-generate-request.dto.js";
import type { AiGenerateResponse } from "../dto/ai-generate-response.dto.js";

export type AiInteractionMode = "runtime" | "report" | "context_only" | "fallback";

export type AiInteractionLog = {
  id: string; timestamp: string; createdAt: string; agentId?: string; projectId?: string; userId?: string;
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

  constructor(private readonly prisma: PrismaService) {}

  async logInteraction(request: AiGenerateRequest, response: AiGenerateResponse): Promise<void> {
    const createdAt = new Date().toISOString();
    const log: AiInteractionLog = {
      id: `ai_log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: createdAt,
      createdAt,
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

    this.persistInteraction(log, {
      tenantId: request.metadata?.tenantId as string | undefined,
      modelName: response.modelName,
      estimatedCostUsd: response.estimatedCost,
    });
  }

  async logSyntheticInteraction(input: SyntheticAiInteractionInput): Promise<void> {
    const createdAt = new Date().toISOString();
    const log: AiInteractionLog = {
      id: `ai_log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: createdAt,
      createdAt,
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

  getRecentLogs(limit = 50): AiInteractionLog[] {
    return this.buffer.slice(-limit).reverse();
  }

  async getDbLogs(limit = 100): Promise<Array<Record<string, unknown>>> {
    const rows = await this.prisma.aiInteractionLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((row: PersistedAiInteractionRow) => this.toLogView(row));
  }

  async getStats(): Promise<Record<string, unknown>> {
    const [total, successes, byModel, byTask, rows] = await Promise.all([
      this.prisma.aiInteractionLog.count(),
      this.prisma.aiInteractionLog.count({ where: { success: true } }),
      this.prisma.aiInteractionLog.groupBy({ by: ["modelSlug"], _count: { id: true } }),
      this.prisma.aiInteractionLog.groupBy({ by: ["taskType"], _count: { id: true } }),
      this.prisma.aiInteractionLog.findMany({
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
    },
  ) {
    this.buffer.push(log);
    if (this.buffer.length > this.MAX_BUFFER) this.buffer.shift();

    void this.prisma.aiInteractionLog.create({
      data: {
        id: log.id,
        tenantId: options?.tenantId,
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
        latencyMs: log.latencyMs,
        routeReason: log.routeReason,
        fallbackUsed: log.fallbackUsed,
        success: log.success,
        errorMessage: log.errorMessage,
        eligibleForTraining: log.eligibleForTraining,
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
