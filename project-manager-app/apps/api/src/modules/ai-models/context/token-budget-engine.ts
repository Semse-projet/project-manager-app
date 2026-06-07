/**
 * TokenBudgetEngine — default ContextEngine implementation.
 *
 * Fires compression when prompt tokens exceed THRESHOLD_PERCENT of the
 * model's context window. Compression strategy: keep system prompt +
 * last PROTECT_LAST_N turns; replace middle turns with a summary stub.
 */
import type {
  ContextEngine,
  ContextEngineStatus,
  ConversationMessage,
  TokenUsage,
} from "./context-engine.interface.js";

const THRESHOLD_PERCENT = 0.75;
const PROTECT_FIRST_N = 1;   // always keep system message
const PROTECT_LAST_N = 6;    // always keep recent turns

export class TokenBudgetEngine implements ContextEngine {
  readonly name = "token-budget";

  lastPromptTokens = 0;
  lastCompletionTokens = 0;
  thresholdTokens: number;
  contextLength: number;
  compressionCount = 0;

  constructor(contextLength = 128_000) {
    this.contextLength = contextLength;
    this.thresholdTokens = Math.floor(contextLength * THRESHOLD_PERCENT);
  }

  updateFromResponse(usage: TokenUsage): void {
    this.lastPromptTokens = usage.promptTokens;
    this.lastCompletionTokens = usage.completionTokens;
  }

  shouldCompress(promptTokens?: number): boolean {
    const tokens = promptTokens ?? this.lastPromptTokens;
    return tokens > 0 && tokens >= this.thresholdTokens;
  }

  compress(messages: ConversationMessage[], _focusTopic?: string): ConversationMessage[] {
    if (messages.length <= PROTECT_FIRST_N + PROTECT_LAST_N) {
      return messages;
    }

    const head = messages.slice(0, PROTECT_FIRST_N);
    const tail = messages.slice(-PROTECT_LAST_N);
    const middle = messages.slice(PROTECT_FIRST_N, messages.length - PROTECT_LAST_N);

    const summaryContent = `[Context compressed: ${middle.length} earlier turns summarized. ` +
      `Key topics covered in the compressed portion. Continue from the recent turns below.]`;

    const summaryMessage: ConversationMessage = {
      role: "system",
      content: summaryContent,
    };

    this.compressionCount++;
    return [...head, summaryMessage, ...tail];
  }

  onSessionReset(): void {
    this.lastPromptTokens = 0;
    this.lastCompletionTokens = 0;
    this.compressionCount = 0;
  }

  getStatus(): ContextEngineStatus {
    return {
      name: this.name,
      lastPromptTokens: this.lastPromptTokens,
      contextLength: this.contextLength,
      usagePercent: this.contextLength > 0
        ? Math.min(100, (this.lastPromptTokens / this.contextLength) * 100)
        : 0,
      compressionCount: this.compressionCount,
      thresholdTokens: this.thresholdTokens,
    };
  }
}

/** Factory — select engine by name. Extend with new engines as needed. */
export function createContextEngine(name = "token-budget", contextLength?: number): ContextEngine {
  if (name === "token-budget") {
    return new TokenBudgetEngine(contextLength);
  }
  throw new Error(`Unknown context engine: "${name}"`);
}
