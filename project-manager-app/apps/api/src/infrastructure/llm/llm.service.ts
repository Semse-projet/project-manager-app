import { Injectable } from "@nestjs/common";
import { LLMOrchestrator } from "./orchestrator.js";
import type { CopilotRoutingContext, CopilotTool, CopilotToolCall } from "./types.js";

// Legacy shapes kept for backward compat with agents.service.ts
export type LLMMessage = { role: "user" | "assistant"; content: string };
export type LLMToolDefinition = CopilotTool;
export type LLMToolCall = CopilotToolCall;

export type LLMChatInput = {
  systemPrompt: string;
  history: LLMMessage[];
  userMessage: string;
  maxTokens?: number;
};

export type LLMChatWithToolsInput = LLMChatInput & {
  tools: LLMToolDefinition[];
  context?: CopilotRoutingContext;
};

export type LLMChatResult = {
  text: string;
  fromLLM: boolean;
  toolCalls: LLMToolCall[];
  provider?: string;
  model?: string;
  mode?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
};

/**
 * Thin facade over LLMOrchestrator.
 * Keeps the original API surface so agents.service.ts needs no changes.
 */
@Injectable()
export class LLMService {
  constructor(private readonly orchestrator: LLMOrchestrator) {}

  get isAvailable(): boolean {
    return this.orchestrator.hasLLMProvider;
  }

  async chat(input: LLMChatInput): Promise<LLMChatResult> {
    const res = await this.orchestrator.chat({
      systemPrompt: input.systemPrompt,
      history: input.history,
      userMessage: input.userMessage,
      maxTokens: input.maxTokens,
    });
    return {
      text: res.text,
      fromLLM: res.metadata.mode !== "fallback",
      toolCalls: res.toolCalls,
      provider: res.provider,
      model: res.model,
      mode: res.metadata.mode,
      inputTokens: res.usage?.inputTokens,
      outputTokens: res.usage?.outputTokens,
      cacheCreationTokens: res.usage?.cacheCreationTokens,
      cacheReadTokens: res.usage?.cacheReadTokens,
    };
  }

  async chatWithTools(input: LLMChatWithToolsInput): Promise<LLMChatResult> {
    const res = await this.orchestrator.chat({
      systemPrompt: input.systemPrompt,
      history: input.history,
      userMessage: input.userMessage,
      tools: input.tools,
      context: input.context ?? { requiresTools: true },
      maxTokens: input.maxTokens,
    });
    return {
      text: res.text,
      fromLLM: res.metadata.mode !== "fallback",
      toolCalls: res.toolCalls,
      provider: res.provider,
      model: res.model,
      mode: res.metadata.mode,
      inputTokens: res.usage?.inputTokens,
      outputTokens: res.usage?.outputTokens,
      cacheCreationTokens: res.usage?.cacheCreationTokens,
      cacheReadTokens: res.usage?.cacheReadTokens,
    };
  }
}
