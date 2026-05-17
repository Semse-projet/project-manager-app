// ─────────────────────────────────────────────────────────────────────────────
// LLM Orchestration — core types
// ─────────────────────────────────────────────────────────────────────────────

export type LLMProviderName = "anthropic" | "openai" | "ollama" | "template";

export type TaskType =
  | "chat"
  | "tool_use"
  | "high_risk_action"
  | "low_risk_action"
  | "search"
  | "unknown";

// ── Tool schema (provider-agnostic) ──────────────────────────────────────────

export type CopilotTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type CopilotToolCall = {
  toolName: string;
  toolUseId: string;
  input: Record<string, unknown>;
};

// ── Routing context ───────────────────────────────────────────────────────────

export type CopilotRoutingContext = {
  requiresTools?: boolean;
  riskLevel?: "low" | "medium" | "high";
  privacyCritical?: boolean;
  localOnly?: boolean;       // force local (Ollama) provider only
  lowCost?: boolean;
  lowLatency?: boolean;
  preferredProvider?: LLMProviderName;
  fallbackOrder?: LLMProviderName[];
  taskType?: TaskType;
  routingReason?: string;    // caller hint for log tracing
  agentName?: string;        // which agent triggered this call
  source?: string;           // prometeo | buildops | tools | hermes | etc.
};

// ── Chat input / output ───────────────────────────────────────────────────────

export type LLMChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMChatInput = {
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
  tools?: CopilotTool[];
  context?: CopilotRoutingContext;
  maxTokens?: number;
};

export type LLMUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
};

export type LLMChatResponse = {
  text: string;
  provider: LLMProviderName;
  model?: string;
  toolCalls: CopilotToolCall[];
  usage?: LLMUsage;
  metadata: {
    latencyMs: number;
    fallbackUsed: boolean;
    mode: "llm" | "runtime" | "fallback" | "local";
  };
};

// ── Provider interface ────────────────────────────────────────────────────────

export interface LLMProvider {
  readonly name: LLMProviderName;
  readonly supportsTools: boolean;
  readonly supportsStreaming: boolean;

  isAvailable(): boolean;
  chat(input: LLMChatInput): Promise<LLMChatResponse>;
  healthCheck?(): Promise<boolean>;
}
