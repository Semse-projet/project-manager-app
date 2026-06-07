import type { LLMChatInput, LLMChatResponse, LLMProvider } from "../types.js";

export class TemplateProvider implements LLMProvider {
  readonly name = "template" as const;
  readonly supportsTools = false;
  readonly supportsStreaming = false;

  private readonly generateFn: (input: LLMChatInput) => string;

  constructor(generateFn: (input: LLMChatInput) => string) {
    this.generateFn = generateFn;
  }

  isAvailable(): boolean { return true; }

  async chat(input: LLMChatInput): Promise<LLMChatResponse> {
    const t0 = Date.now();
    const text = this.generateFn(input);
    return {
      text,
      provider: "template",
      model: "template",
      toolCalls: [],
      metadata: { latencyMs: Date.now() - t0, fallbackUsed: true, mode: "fallback" },
    };
  }
}
