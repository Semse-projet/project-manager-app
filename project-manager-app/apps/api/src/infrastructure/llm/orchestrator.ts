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
    if (process.env.ANTHROPIC_API_KEY) {
      this.providers.set("anthropic", new AnthropicProvider(process.env.ANTHROPIC_API_KEY));
      this.logger.log("Provider registered: anthropic");
    }
    if (process.env.OPENAI_API_KEY) {
      this.providers.set("openai", new OpenAIProvider(process.env.OPENAI_API_KEY));
      this.logger.log("Provider registered: openai");
    }
    if (process.env.ENABLE_OPEN_SOURCE_MODELS === "true") {
      this.providers.set("ollama", new OllamaProvider());
      this.logger.log("Provider registered: ollama");
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

  async chat(input: LLMChatInput): Promise<LLMChatResponse> {
    const ctx = input.context;
    const taskType: TaskType = this.adaptiveRouter.inferTaskType(ctx);
    const available = [...this.providers.keys()];

    // Use adaptive ranking; fall back to static chain for context-free calls
    const chain = this.useAdaptiveRouting()
      ? this.adaptiveRouter.rank(available, ctx, taskType)
      : buildFallbackChain(available[0] ?? "template", ctx);

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

        this.logResult(final, taskType, i);
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

  private logResult(res: LLMChatResponse, taskType: TaskType, attempt: number): void {
    const u = res.usage;
    const snap = this.metrics.snapshot(res.provider, taskType);
    this.logger.log(
      `[orchestrator] provider=${res.provider} model=${res.model ?? "?"} ` +
      `taskType=${taskType} attempt=${attempt + 1} ` +
      `latency=${res.metadata.latencyMs}ms ` +
      `in=${u?.inputTokens ?? 0} out=${u?.outputTokens ?? 0} ` +
      `cache_read=${u?.cacheReadTokens ?? 0} ` +
      `tools=${res.toolCalls.length} fallback=${res.metadata.fallbackUsed} ` +
      `score=${snap.score} successRate=${(snap.successRate * 100).toFixed(0)}% ` +
      `avgLatency=${snap.avgLatencyMs}ms`,
    );
  }
}
