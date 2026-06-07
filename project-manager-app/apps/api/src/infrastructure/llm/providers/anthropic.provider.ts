import Anthropic from "@anthropic-ai/sdk";
import {
  fromAnthropicToolUse,
  toAnthropicTools,
} from "../adapters/tools.adapter.js";
import type { LLMChatInput, LLMChatResponse, LLMProvider } from "../types.js";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic" as const;
  readonly supportsTools = true;
  readonly supportsStreaming = false;

  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  isAvailable(): boolean { return true; }

  async chat(input: LLMChatInput): Promise<LLMChatResponse> {
    const t0 = Date.now();
    const tools = input.tools?.length ? toAnthropicTools(input.tools) : undefined;
    const messages: Anthropic.MessageParam[] = [
      ...input.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: input.userMessage },
    ];
    const system: Anthropic.TextBlockParam[] = [
      { type: "text", text: input.systemPrompt, cache_control: { type: "ephemeral" } },
    ];

    const allToolCalls: ReturnType<typeof fromAnthropicToolUse> = [];
    let finalText = "";
    let totalUsage: AnthropicUsage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

    for (let turn = 0; turn < 5; turn++) {
      const params: Anthropic.MessageCreateParamsNonStreaming = {
        model: MODEL,
        max_tokens: input.maxTokens ?? 1024,
        system,
        messages,
        ...(tools ? { tools, tool_choice: { type: "auto" } } : {}),
      };

      const response = await this.client.messages.create(params);
      const usage = response.usage as unknown as AnthropicUsage;
      totalUsage = {
        input_tokens: (totalUsage.input_tokens ?? 0) + (usage.input_tokens ?? 0),
        output_tokens: (totalUsage.output_tokens ?? 0) + (usage.output_tokens ?? 0),
        cache_creation_input_tokens: (totalUsage.cache_creation_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
        cache_read_input_tokens: (totalUsage.cache_read_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
      };

      const turnText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text).join("");
      if (turnText) finalText = turnText;

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      if (!toolUseBlocks.length || response.stop_reason !== "tool_use") break;

      allToolCalls.push(...fromAnthropicToolUse(toolUseBlocks));
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: toolUseBlocks.map((b) => ({
          type: "tool_result" as const,
          tool_use_id: b.id,
          content: "Propuesta registrada. Continúa.",
        })),
      });
    }

    return {
      text: finalText,
      provider: "anthropic",
      model: MODEL,
      toolCalls: allToolCalls,
      usage: {
        inputTokens: totalUsage.input_tokens,
        outputTokens: totalUsage.output_tokens,
        cacheCreationTokens: totalUsage.cache_creation_input_tokens,
        cacheReadTokens: totalUsage.cache_read_input_tokens,
      },
      metadata: { latencyMs: Date.now() - t0, fallbackUsed: false, mode: "llm" },
    };
  }
}
