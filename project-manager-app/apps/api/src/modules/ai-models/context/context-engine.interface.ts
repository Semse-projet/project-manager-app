/**
 * ContextEngine — pluggable context management interface.
 * Inspired by Hermes's agent/context_engine.py abstract base class.
 *
 * The engine decides when a conversation is approaching token limits
 * and how to compress it. Only one engine is active per gateway instance.
 * The default implementation is TokenBudgetEngine.
 */

export interface ConversationMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  estimatedTokens?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ContextEngineStatus {
  name: string;
  lastPromptTokens: number;
  contextLength: number;
  usagePercent: number;
  compressionCount: number;
  thresholdTokens: number;
}

export interface ContextEngine {
  readonly name: string;

  lastPromptTokens: number;
  lastCompletionTokens: number;
  thresholdTokens: number;
  contextLength: number;
  compressionCount: number;

  /** Called after every LLM API response with token usage. */
  updateFromResponse(usage: TokenUsage): void;

  /** Returns true if the engine wants to compress the conversation now. */
  shouldCompress(promptTokens?: number): boolean;

  /**
   * Compress the message list and return a shorter valid sequence.
   * The implementation may summarize, drop old turns, or both.
   */
  compress(
    messages: ConversationMessage[],
    focusTopic?: string,
  ): ConversationMessage[];

  /** Called when a new conversation session starts. */
  onSessionStart?(sessionId: string): void;

  /** Called when a session truly ends (not per-turn). */
  onSessionEnd?(sessionId: string, messages: ConversationMessage[]): void;

  /** Reset per-session state (called on /new or explicit reset). */
  onSessionReset?(): void;

  /** Read-only status snapshot for monitoring. */
  getStatus(): ContextEngineStatus;
}
