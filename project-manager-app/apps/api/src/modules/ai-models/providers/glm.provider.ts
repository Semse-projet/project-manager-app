import { Logger } from "@nestjs/common";
import type { AiGenerateRequest } from "../dto/ai-generate-request.dto.js";
import type { AiGenerateResponse } from "../dto/ai-generate-response.dto.js";
import { buildSafeSystemPrompt, wrapOperationalContext, wrapUserInput } from "../prompt-safety.js";

/**
 * GLM (Zhipu AI) provider — OpenAI-compatible /chat/completions.
 * Two deployment modes share this one class:
 *  - hosted:      Zhipu's cloud API (bigmodel.cn), gated by an API key.
 *  - self-hosted: a GLM tag pulled into the project's Ollama service on
 *    Railway, reachable at OLLAMA_BASE_URL + "/v1" with no key required.
 */
export class GlmProvider {
  private readonly logger = new Logger(GlmProvider.name);
  readonly providerName = "glm";

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string | undefined,
    private readonly modelName: string,
    private readonly modelSlug: string,
    private readonly requiresApiKey: boolean,
  ) {}

  async isAvailable(): Promise<boolean> {
    if (!this.requiresApiKey) return true;
    return typeof this.apiKey === "string" && this.apiKey.length > 10;
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    if (!(await this.isAvailable())) throw new Error("GLM API key not configured.");

    const messages: Array<{ role: string; content: string }> = [];
    messages.push({
      role: "system",
      content: buildSafeSystemPrompt(request.systemPrompt, "You are a helpful AI assistant for SEMSEproject."),
    });
    if (request.context) messages.push({ role: "system", content: wrapOperationalContext(request.context) });
    messages.push({ role: "user", content: wrapUserInput(request.input) });

    const start = Date.now();
    const resp = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.modelName,
        messages,
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens ?? 4096,
        ...(request.requireJson ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`GLM API ${resp.status}: ${err.slice(0, 200)}`);
    }

    const json = (await resp.json()) as { choices: Array<{ message: { content: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const output = json.choices[0]?.message.content ?? "";

    this.logger.log(`[glm] model=${this.modelName} tokens=${json.usage?.completion_tokens ?? 0} latency=${Date.now() - start}ms`);

    return {
      output, provider: "glm", modelSlug: this.modelSlug, modelName: this.modelName,
      inputTokens: json.usage?.prompt_tokens, outputTokens: json.usage?.completion_tokens,
      latencyMs: Date.now() - start, success: true,
    };
  }
}
