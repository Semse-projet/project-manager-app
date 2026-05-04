import { Injectable, Logger } from "@nestjs/common";
import { LLMOrchestrator } from "../../../infrastructure/llm/orchestrator.js";
import type { AiGenerateRequest } from "../dto/ai-generate-request.dto.js";
import type { AiGenerateResponse } from "../dto/ai-generate-response.dto.js";
import { AiModelRouterService } from "../router/ai-model-router.service.js";
import { DeepSeekProvider } from "../providers/deepseek.provider.js";
import { KimiProvider } from "../providers/kimi.provider.js";
import { createContextEngine } from "../context/token-budget-engine.js";
import type { ContextEngine, ContextEngineStatus } from "../context/context-engine.interface.js";

@Injectable()
export class AiModelGatewayService {
  private readonly logger = new Logger(AiModelGatewayService.name);
  private readonly deepseekChat: DeepSeekProvider;
  private readonly deepseekReasoner: DeepSeekProvider;
  private readonly kimi: KimiProvider;
  private readonly contextEngine: ContextEngine;

  constructor(
    private readonly router: AiModelRouterService,
    private readonly llmOrchestrator: LLMOrchestrator,
  ) {
    const dsKey = process.env.DEEPSEEK_API_KEY;
    this.deepseekChat = new DeepSeekProvider(dsKey, process.env.DEEPSEEK_DEFAULT_MODEL ?? "deepseek-chat");
    this.deepseekReasoner = new DeepSeekProvider(dsKey, process.env.DEEPSEEK_REASONER_MODEL ?? "deepseek-reasoner");
    this.kimi = new KimiProvider(process.env.KIMI_API_KEY, process.env.KIMI_DEFAULT_MODEL ?? "moonshot-v1-128k");
    this.contextEngine = createContextEngine("token-budget", 128_000);
  }

  getContextStatus(): ContextEngineStatus {
    return this.contextEngine.getStatus();
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    const start = Date.now();
    const route = this.router.selectRoute(request);

    // Context budget check — warn if approaching window limit
    if (this.contextEngine.shouldCompress()) {
      this.logger.warn(
        `[gateway] context budget at ${this.contextEngine.getStatus().usagePercent.toFixed(1)}% — ` +
        `consider compressing conversation history`,
      );
    }

    this.logger.log(`[gateway] task=${request.taskType} → ${route.primaryModelSlug} (${route.reason})`);

    try {
      return await this.executeWithSlug(route.primaryModelSlug, request, route.reason, false);
    } catch (primaryErr) {
      const primaryMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      this.logger.warn(`[gateway] primary ${route.primaryModelSlug} failed: ${primaryMsg}`);

      if (!route.fallbackModelSlug || route.fallbackModelSlug === route.primaryModelSlug) {
        return { output: "", provider: "none", modelSlug: route.primaryModelSlug, modelName: "", success: false, errorMessage: primaryMsg, latencyMs: Date.now() - start, routeReason: route.reason, fallbackUsed: false };
      }

      try {
        this.logger.log(`[gateway] fallback → ${route.fallbackModelSlug}`);
        return await this.executeWithSlug(route.fallbackModelSlug, request, route.reason, true);
      } catch (fallbackErr) {
        const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        this.logger.error(`[gateway] fallback ${route.fallbackModelSlug} also failed: ${fallbackMsg}`);
        return { output: "", provider: "none", modelSlug: route.fallbackModelSlug, modelName: "", success: false, errorMessage: fallbackMsg, latencyMs: Date.now() - start, routeReason: route.reason, fallbackUsed: true };
      }
    }
  }

  private async executeWithSlug(slug: string, request: AiGenerateRequest, routeReason: string, fallbackUsed: boolean): Promise<AiGenerateResponse> {
    // Prometeo-native providers
    if (slug === "deepseek-chat") {
      const resp = { ...(await this.deepseekChat.generate(request)), routeReason, fallbackUsed };
      this.feedContextEngine(resp.inputTokens, resp.outputTokens);
      return resp;
    }
    if (slug === "deepseek-reasoner") {
      const resp = { ...(await this.deepseekReasoner.generate(request)), routeReason, fallbackUsed };
      this.feedContextEngine(resp.inputTokens, resp.outputTokens);
      return resp;
    }
    if (slug === "kimi-k2") {
      const resp = { ...(await this.kimi.generate(request)), routeReason, fallbackUsed };
      this.feedContextEngine(resp.inputTokens, resp.outputTokens);
      return resp;
    }

    // Route everything else through the existing LLM orchestrator (Anthropic, OpenAI, Ollama)
    const providerName = slug === "claude-sonnet" ? "anthropic" : slug === "openai-gpt4" ? "openai" : slug === "ollama-local" ? "ollama" : undefined;
    const startedAt = Date.now();

    const result = await this.llmOrchestrator.chat({
      systemPrompt: request.systemPrompt ?? "You are a helpful AI assistant for SEMSEproject.",
      history: [],
      userMessage: request.context ? `${request.context}\n\n${request.input}` : request.input,
      context: {
        preferredProvider: providerName as "anthropic" | "openai" | "ollama" | "template" | undefined,
        taskType: "chat",
        requiresTools: false,
      },
      maxTokens: request.maxTokens,
    });

    this.feedContextEngine(result.usage?.inputTokens, result.usage?.outputTokens);

    return {
      output: result.text,
      provider: result.provider ?? providerName ?? "anthropic",
      modelSlug: slug,
      modelName: result.model ?? slug,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      latencyMs: result.metadata.latencyMs ?? (Date.now() - startedAt),
      routeReason,
      fallbackUsed,
      success: true,
    };
  }

  private feedContextEngine(inputTokens?: number, outputTokens?: number): void {
    if (!inputTokens && !outputTokens) return;
    const promptTokens = inputTokens ?? 0;
    const completionTokens = outputTokens ?? 0;
    this.contextEngine.updateFromResponse({
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    });
  }

  getModelRegistry() {
    // Registry imported at module level via controller
    return [];
  }

  getRoute(request: AiGenerateRequest) {
    return this.router.selectRoute(request);
  }

  hasRuntimeProvider(): boolean {
    return this.llmOrchestrator.hasLLMProvider;
  }

  getRuntimeProviders(): string[] {
    return this.llmOrchestrator.getRegisteredProviders();
  }
}
