import OpenAI from "openai";
import { fromOpenAIToolCalls, toOpenAITools } from "../adapters/tools.adapter.js";
import type { LLMChatInput, LLMChatResponse, LLMProvider } from "../types.js";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai" as const;
  readonly supportsTools = true;
  readonly supportsStreaming = false;

  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  isAvailable(): boolean { return true; }

  async chat(input: LLMChatInput): Promise<LLMChatResponse> {
    const t0 = Date.now();
    const tools = input.tools?.length ? toOpenAITools(input.tools) : undefined;

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: input.systemPrompt },
      ...input.history.map((m) => ({ role: m.role, content: m.content } as OpenAI.ChatCompletionMessageParam)),
      { role: "user", content: input.userMessage },
    ];

    const allToolCalls: ReturnType<typeof fromOpenAIToolCalls> = [];
    let finalText = "";
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let turn = 0; turn < 5; turn++) {
      const response = await this.client.chat.completions.create({
        model: MODEL,
        max_tokens: input.maxTokens ?? 1024,
        messages,
        ...(tools ? { tools, tool_choice: "auto" } : {}),
      });

      const choice = response.choices[0];
      if (!choice) break;

      totalInputTokens += response.usage?.prompt_tokens ?? 0;
      totalOutputTokens += response.usage?.completion_tokens ?? 0;

      const text = choice.message.content ?? "";
      if (text) finalText = text;

      const toolCalls = choice.message.tool_calls;
      if (!toolCalls?.length || choice.finish_reason !== "tool_calls") break;

      const parsed = fromOpenAIToolCalls(toolCalls);
      allToolCalls.push(...parsed);

      // Append assistant message with tool_calls
      messages.push({ role: "assistant", content: text || null, tool_calls: toolCalls });

      // Append tool results
      for (const tc of toolCalls) {
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: "Propuesta registrada. Continúa.",
        });
      }
    }

    return {
      text: finalText,
      provider: "openai",
      model: MODEL,
      toolCalls: allToolCalls,
      usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, totalTokens: totalInputTokens + totalOutputTokens },
      metadata: { latencyMs: Date.now() - t0, fallbackUsed: false, mode: "llm" },
    };
  }
}
