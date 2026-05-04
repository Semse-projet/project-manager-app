import { Logger } from "@nestjs/common";
import type { AiGenerateRequest } from "../dto/ai-generate-request.dto.js";
import type { AiGenerateResponse } from "../dto/ai-generate-response.dto.js";

const BASE_URL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";

export class DeepSeekProvider {
  private readonly logger = new Logger(DeepSeekProvider.name);
  readonly providerName = "deepseek";

  constructor(private readonly apiKey: string | undefined, private readonly modelName: string) {}

  async isAvailable(): Promise<boolean> {
    return typeof this.apiKey === "string" && this.apiKey.length > 10;
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    if (!(await this.isAvailable())) throw new Error("DeepSeek API key not configured.");

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) messages.push({ role: "system", content: request.systemPrompt });
    if (request.context) messages.push({ role: "system", content: `Context:\n${request.context}` });
    messages.push({ role: "user", content: request.input });

    const start = Date.now();
    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
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
      throw new Error(`DeepSeek API ${resp.status}: ${err.slice(0, 200)}`);
    }

    const json = (await resp.json()) as { choices: Array<{ message: { content: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const output = json.choices[0]?.message.content ?? "";

    this.logger.log(`[deepseek] model=${this.modelName} tokens=${json.usage?.completion_tokens ?? 0} latency=${Date.now() - start}ms`);

    return {
      output, provider: "deepseek", modelSlug: this.modelName.includes("reasoner") ? "deepseek-reasoner" : "deepseek-chat",
      modelName: this.modelName, inputTokens: json.usage?.prompt_tokens, outputTokens: json.usage?.completion_tokens,
      latencyMs: Date.now() - start, success: true,
    };
  }
}
