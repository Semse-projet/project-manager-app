/**
 * SEMSE observability logging — TypeScript/Node.js version
 * Mirrors Python utils.logging.SEMSELogger pattern for distributed tracing
 */

import { randomUUID } from "node:crypto";

export const LogLevel = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

const LEVEL_ORDER: readonly LogLevel[] = [
  LogLevel.DEBUG,
  LogLevel.INFO,
  LogLevel.WARN,
  LogLevel.ERROR,
];

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  service: string;
  runId: string;
  traceId: string;
  spanId?: string;
  spanName?: string;
  spanDepth?: number;
  context?: Record<string, unknown>;
  data?: Record<string, unknown>;
  durationMs?: number;
}

export class SEMSELogger {
  private readonly service: string;
  readonly runId: string;
  readonly traceId: string;
  private readonly minLevel: LogLevel;
  private contextStack: Array<Record<string, unknown>> = [];
  private spanStack: Array<{ spanId: string; name: string; startTime: number }> = [];

  constructor(
    service: string,
    options?: {
      runId?: string;
      traceId?: string;
      minLevel?: LogLevel;
    }
  ) {
    this.service = service;
    this.runId = options?.runId ?? randomUUID();
    this.traceId = options?.traceId ?? randomUUID();
    this.minLevel = options?.minLevel ?? LogLevel.DEBUG;
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, message, data);
  }

  *span(name: string, data?: Record<string, unknown>) {
    const spanId = randomUUID();
    const startTime = Date.now();
    this.spanStack.push({ spanId, name, startTime });

    this.info(`[span.start] ${name}`, { spanId, spanName: name, ...data });

    try {
      yield spanId;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      this.error(`[span.error] ${name}`, {
        spanId,
        spanName: name,
        durationMs: elapsed,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : "Unknown",
      });
      this.spanStack.pop();
      throw error;
    }

    const elapsed = Date.now() - startTime;
    this.info(`[span.end] ${name}`, {
      spanId,
      spanName: name,
      durationMs: elapsed,
    });
    this.spanStack.pop();
  }

  /**
   * Async-friendly span: logs start/end (or error) around `fn` and returns its value.
   */
  async withSpan<T>(
    name: string,
    fn: (spanId: string) => T | Promise<T>,
    data?: Record<string, unknown>
  ): Promise<T> {
    const spanId = randomUUID();
    const startTime = Date.now();
    this.spanStack.push({ spanId, name, startTime });

    this.info(`[span.start] ${name}`, { spanId, spanName: name, ...data });

    try {
      const result = await fn(spanId);
      this.info(`[span.end] ${name}`, {
        spanId,
        spanName: name,
        durationMs: Date.now() - startTime,
      });
      return result;
    } catch (error) {
      this.error(`[span.error] ${name}`, {
        spanId,
        spanName: name,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : "Unknown",
      });
      throw error;
    } finally {
      this.spanStack.pop();
    }
  }

  context(ctx: Record<string, unknown>, fn: () => void | Promise<void>) {
    this.contextStack.push(ctx);
    try {
      return fn();
    } finally {
      this.contextStack.pop();
    }
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    if (this.shouldSkipLevel(level)) return;

    const entry: LogEntry = {
      level: level,
      message,
      timestamp: new Date().toISOString(),
      service: this.service,
      runId: this.runId,
      traceId: this.traceId,
    };

    // Add span context
    if (this.spanStack.length > 0) {
      const currentSpan = this.spanStack[this.spanStack.length - 1];
      entry.spanId = currentSpan.spanId;
      entry.spanName = currentSpan.name;
      entry.spanDepth = this.spanStack.length;
    }

    // Add context values
    if (this.contextStack.length > 0) {
      entry.context = {};
      for (const ctx of this.contextStack) {
        Object.assign(entry.context, ctx);
      }
    }

    if (data) {
      entry.data = data;
    }

    // Output JSON to stdout
    console.log(JSON.stringify(entry));
  }

  private shouldSkipLevel(level: LogLevel): boolean {
    return LEVEL_ORDER.indexOf(level) < LEVEL_ORDER.indexOf(this.minLevel);
  }
}

/**
 * Factory function to create a logger
 */
export function createLogger(
  service: string,
  options?: { runId?: string; traceId?: string; minLevel?: LogLevel }
) {
  return new SEMSELogger(service, options);
}
