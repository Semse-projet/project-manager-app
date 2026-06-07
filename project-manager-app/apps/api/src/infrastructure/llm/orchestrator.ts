import { Injectable, Logger } from "@nestjs/common";
import { generateAgentResponse } from "../../common/chat-thread.store.js";
import { ProviderMetricsStore } from "./metrics/provider-metrics.store.js";
import { AnthropicProvider } from "./providers/anthropic.provider.js";
import { OllamaProvider } from "./providers/ollama.provider.js";
import { OpenAIProvider } from "./providers/openai.provider.js";
import { TemplateProvider } from "./providers/template.provider.js";
import { AdaptiveRouter } from "./router/adaptive-router.js";
import { buildFallbackChain } from "./router/routing-policy.js";
import type {
  CopilotRoutingContext,
  LLMChatInput,
  LLMChatResponse,
  LLMProvider,
  LLMProviderName,
  TaskType,
} from "./types.js";

@Injectable()
export class LLMOrchestrator {
  private readonly logger = new Logger(LLMOrchestrator.name);
  private readonly providers = new Map<LLMProviderName, LLMProvider>();

  constructor(
    private readonly metrics: ProviderMetricsStore,
    private readonly adaptiveRouter: AdaptiveRouter,
  ) {
    this.initProviders();
  }

  private initProviders(): void {
    const defaultProvider = process.env.LLM_DEFAULT_PROVIDER ?? "ollama";

    // Ollama — native/local primary. Registered whenever it is the default or explicitly enabled.
    const ollamaEnabled =
      defaultProvider === "ollama" ||
      process.env.ENABLE_OPEN_SOURCE_MODELS === "true";
    if (ollamaEnabled) {
      this.providers.set("ollama", new OllamaProvider());
      this.logger.log("Provider registered: ollama (native/local)");
    }

    if (process.env.ANTHROPIC_API_KEY) {
      this.providers.set("anthropic", new AnthropicProvider(process.env.ANTHROPIC_API_KEY));
      this.logger.log("Provider registered: anthropic");
    }
    if (process.env.OPENAI_API_KEY) {
      this.providers.set("openai", new OpenAIProvider(process.env.OPENAI_API_KEY));
      this.logger.log("Provider registered: openai");
    }
    this.providers.set("template", new TemplateProvider((input) =>
      generateAgentResponse({
        agentId: "assistant",
        message: input.userMessage,
        history: input.history.map((m) => ({ ...m, timestamp: new Date().toISOString() })),
        context: undefined,
      }),
    ));
  }

  get hasLLMProvider(): boolean {
    return this.providers.has("anthropic") || this.providers.has("openai") || this.providers.has("ollama");
  }

  getRegisteredProviders(): LLMProviderName[] {
    return [...this.providers.keys()];
  }

  metricsSnapshot() {
    return this.metrics.allSnapshots();
  }

  getOllamaProvider(): import("./providers/ollama.provider.js").OllamaProvider | undefined {
    return this.providers.get("ollama") as import("./providers/ollama.provider.js").OllamaProvider | undefined;
  }

  async providerHealthSummary(): Promise<Record<string, {
    registered: boolean;
    healthy?: boolean;
    localOnly: boolean;
    avgLatencyMs: number;
    successRate: number;
    circuitState: string;
  }>> {
    const result: Record<string, { registered: boolean; healthy?: boolean; localOnly: boolean; avgLatencyMs: number; successRate: number; circuitState: string }> = {};

    for (const [name, provider] of this.providers.entries()) {
      const snap = this.metrics.snapshot(name, "chat");
      let healthy: boolean | undefined;

      if (provider.healthCheck) {
        healthy = await provider.healthCheck().catch(() => false);
      }

      result[name] = {
        registered: true,
        healthy,
        localOnly: name === "ollama" || name === "template",
        avgLatencyMs: snap.avgLatencyMs,
        successRate: snap.successRate,
        circuitState: snap.circuitState,
      };
    }

    return result;
  }

  async chat(input: LLMChatInput): Promise<LLMChatResponse> {
    const ctx = input.context;
    const taskType: TaskType = this.adaptiveRouter.inferTaskType(ctx);
    const available = [...this.providers.keys()];

    // Use adaptive ranking; fall back to static chain for context-free calls
    const chain = this.useAdaptiveRouting()
      ? this.adaptiveRouter.rank(available, ctx, taskType)
      : buildFallbackChain(available[0] ?? "template", ctx);

    // Enforce no-cloud policy for localOnly / privacyCritical
    if (ctx?.localOnly || ctx?.privacyCritical) {
      const cloudInChain = chain.filter(
        (p) => p === "anthropic" || p === "openai",
      );
      if (cloudInChain.length > 0) {
        this.logger.warn(
          `[orchestrator] POLICY: removing cloud providers from chain due to ${ctx?.localOnly ? "localOnly" : "privacyCritical"}=true. Removed: ${cloudInChain.join(",")}`,
        );
        chain.splice(0, chain.length, ...chain.filter((p) => p !== "anthropic" && p !== "openai"));
      }
    }

    for (let i = 0; i < chain.length; i++) {
      const providerName = chain[i]!;
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      const isLastResort = i === chain.length - 1;
      const usedFallback = i > 0;

      try {
        const result = await provider.chat(input);
        const final: LLMChatResponse = {
          ...result,
          metadata: { ...result.metadata, fallbackUsed: usedFallback },
        };

        // Record success
        this.metrics.recordSuccess(
          providerName,
          taskType,
          final.metadata.latencyMs,
          (final.usage?.inputTokens ?? 0) + (final.usage?.outputTokens ?? 0),
        );

        this.logResult(final, taskType, i, ctx);
        return final;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`[orchestrator] provider=${providerName} taskType=${taskType} failed: ${msg}`);

        // Record failure
        this.metrics.recordFailure(providerName, taskType, msg);

        if (isLastResort) throw err;
      }
    }

    throw new Error("All LLM providers exhausted");
  }

  private useAdaptiveRouting(): boolean {
    return process.env.ENABLE_LLM_ROUTER !== "false";
  }

  private deriveRoutingReason(ctx: CopilotRoutingContext | undefined, attempt: number): string {
    if (attempt > 0) return "fallback";
    if (!ctx) return "default";
    if (ctx.routingReason) return ctx.routingReason;
    if (ctx.localOnly) return "local-only";
    if (ctx.privacyCritical) return "privacy-critical";
    if (ctx.lowCost) return "low-cost";
    if (ctx.requiresTools) return "tool-use";
    if (ctx.riskLevel === "high") return "risk-high";
    return "default";
  }

  private logResult(
    res: LLMChatResponse,
    taskType: TaskType,
    attempt: number,
    ctx: CopilotRoutingContext | undefined,
  ): void {
    const u = res.usage;
    const snap = this.metrics.snapshot(res.provider, taskType);
    const routingReason = this.deriveRoutingReason(ctx, attempt);
    this.logger.log(
      `[orchestrator] provider=${res.provider} model=${res.model ?? "?"} ` +
      `taskType=${taskType} routingReason=${routingReason} attempt=${attempt + 1} ` +
      `latency=${res.metadata.latencyMs}ms ` +
      `in=${u?.inputTokens ?? 0} out=${u?.outputTokens ?? 0} ` +
      `cache_read=${u?.cacheReadTokens ?? 0} ` +
      `tools=${res.toolCalls.length} fallback=${res.metadata.fallbackUsed} ` +
      `agentName=${ctx?.agentName ?? "-"} source=${ctx?.source ?? "-"} ` +
      `score=${snap.score} successRate=${(snap.successRate * 100).toFixed(0)}% ` +
      `avgLatency=${snap.avgLatencyMs}ms`,
    );
  }
}
