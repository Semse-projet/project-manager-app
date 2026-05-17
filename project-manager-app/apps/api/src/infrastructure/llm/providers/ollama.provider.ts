import { parsePromptToolCall, toPromptTools } from "../adapters/tools.adapter.js";
import type { LLMChatInput, LLMChatResponse, LLMProvider } from "../types.js";

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.1";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_HEALTH_TIMEOUT_MS = 5_000;

type OllamaResponse = {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
};

type OllamaTagsResponse = {
  models?: Array<{ name: string }>;
};

export class OllamaProvider implements LLMProvider {
  readonly name = "ollama" as const;
  readonly supportsTools = false; // uses prompt-based tool parsing
  readonly supportsStreaming = false;

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly healthTimeoutMs: number;
  private readonly apiKey: string | undefined;  // for protected VPS endpoints

  constructor(baseUrl?: string, model?: string, timeoutMs?: number) {
    this.baseUrl = (baseUrl ?? process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.model = model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;
    this.timeoutMs = timeoutMs ?? (Number(process.env.OLLAMA_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
    this.healthTimeoutMs = Number(process.env.OLLAMA_HEALTH_TIMEOUT_MS) || DEFAULT_HEALTH_TIMEOUT_MS;
    this.apiKey = process.env.OLLAMA_API_KEY;  // optional Bearer token for protected VPS
  }

  isAvailable(): boolean { return true; }

  private authHeaders(): Record<string, string> {
    return this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
  }

  /** Basic ping — checks if Ollama server is reachable */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(this.healthTimeoutMs),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Extended health — verifies server + specific model is available */
  async modelHealthCheck(): Promise<{ serverOk: boolean; modelLoaded: boolean; availableModels: string[] }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(this.healthTimeoutMs),
      });
      if (!res.ok) return { serverOk: false, modelLoaded: false, availableModels: [] };

      const data = await res.json() as OllamaTagsResponse;
      const availableModels = (data.models ?? []).map((m) => m.name);
      const modelLoaded = availableModels.some(
        (m) => m === this.model || m.startsWith(this.model.split(":")[0]!),
      );
      return { serverOk: true, modelLoaded, availableModels };
    } catch {
      return { serverOk: false, modelLoaded: false, availableModels: [] };
    }
  }

  getConfig() {
    return {
      baseUrl: this.baseUrl,
      model: this.model,
      timeoutMs: this.timeoutMs,
      healthTimeoutMs: this.healthTimeoutMs,
      hasApiKey: !!this.apiKey,
      isRemote: !this.baseUrl.includes("localhost") && !this.baseUrl.includes("127.0.0.1"),
    };
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
      headers: { "content-type": "application/json", ...this.authHeaders() },
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
