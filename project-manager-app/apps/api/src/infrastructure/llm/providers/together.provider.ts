import OpenAI from "openai";
import type { LLMChatInput, LLMChatResponse, LLMProvider } from "../types.js";

/**
 * Together AI OpenAI-compatible chat completions.
 * Text only in this slice: no tool execution, no implicit routing of sensitive data.
 */
export class TogetherProvider implements LLMProvider {
  readonly name = "together" as const;
  readonly supportsTools = false;
  readonly supportsStreaming = false;
  private readonly client: OpenAI;

  constructor(apiKey: string, private readonly model: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.together.ai/v1",
      timeout: 30_000,
      maxRetries: 0,
    });
  }

  isAvailable(): boolean { return true; }

  async chat(input: LLMChatInput): Promise<LLMChatResponse> {
    if (input.context?.localOnly || input.context?.privacyCritical) {
      throw new Error("Together AI is not allowed for local-only or privacy-critical requests");
    }
    if (input.context?.requiresTools || input.tools?.length) {
      throw new Error("Together AI tool calls are not enabled in this integration");
    }
    if (input.context?.riskLevel === "high") {
      throw new Error("Together AI is not authorized for high-risk tasks");
    }

    const startedAt = Date.now();
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: input.systemPrompt },
      ...input.history.map((m) => ({ role: m.role, content: m.content } as OpenAI.ChatCompletionMessageParam)),
      { role: "user", content: input.userMessage },
    ];
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: input.maxTokens ?? 1024,
    });
    const content = response.choices[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Together AI returned no usable text completion");
    }
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;
    return {
      text: content,
      provider: "together",
      model: this.model,
      toolCalls: [],
      usage: { inputTokens, outputTokens, totalTokens: response.usage?.total_tokens ?? inputTokens + outputTokens },
      metadata: { latencyMs: Date.now() - startedAt, fallbackUsed: false, mode: "llm" },
    };
  }
}
