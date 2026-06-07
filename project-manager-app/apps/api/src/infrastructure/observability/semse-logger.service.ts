import { getObservabilityContext } from "./request-context.store.js";

type LogLevel = "debug" | "info" | "warn" | "error";

export class SemseLoggerService {
  private write(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    const context = getObservabilityContext();
    const payload = {
      ts: new Date().toISOString(),
      level,
      message,
      ...context,
      ...fields
    };

    const line = JSON.stringify(payload);
    if (level === "error") {
      process.stderr.write(`${line}\n`);
      return;
    }
    process.stdout.write(`${line}\n`);
  }

  info(message: string, fields?: Record<string, unknown>): void {
    this.write("info", message, fields);
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.write("warn", message, fields);
  }

  error(message: string, fields?: Record<string, unknown>): void {
    this.write("error", message, fields);
  }
}
