import { parsePromptToolCall, toPromptTools } from "../adapters/tools.adapter.js";
import type { LLMChatInput, LLMChatResponse, LLMProvider } from "../types.js";

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.1";
const DEFAULT_TIMEOUT_MS = 60_000;

type OllamaResponse = {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
};

export class OllamaProvider implements LLMProvider {
  readonly name = "ollama" as const;
  readonly supportsTools = false; // uses prompt-based tool parsing
  readonly supportsStreaming = false;

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(baseUrl?: string, model?: string, timeoutMs?: number) {
    this.baseUrl = (baseUrl ?? process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.model = model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;
    this.timeoutMs = timeoutMs ?? (Number(process.env.OLLAMA_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  }

  isAvailable(): boolean { return true; }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async chat(input: LLMChatInput): Promise<LLMChatResponse> {
    const t0 = Date.now();
    const toolHint = input.tools?.length ? toPromptTools(input.tools) : "";
    const systemContent = input.systemPrompt + toolHint;

    const messages = [
      { role: "system", content: systemContent },
      ...input.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: input.userMessage },
    ];

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, messages, stream: false }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    }

    const data = await res.json() as OllamaResponse;
    const text = data.message?.content ?? "";
    const toolCall = input.tools?.length ? parsePromptToolCall(text) : null;
    const finalText = toolCall ? "" : text; // if tool call detected, text is the JSON blob

    return {
      text: finalText,
      provider: "ollama",
      model: this.model,
      toolCalls: toolCall ? [toolCall] : [],
      usage: {
        inputTokens: data.prompt_eval_count,
        outputTokens: data.eval_count,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
      metadata: { latencyMs: Date.now() - t0, fallbackUsed: false, mode: "local" },
    };
  }
}
