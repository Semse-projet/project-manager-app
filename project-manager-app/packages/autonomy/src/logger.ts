import { randomUUID } from "node:crypto";
import type { AutonomyRunLogEntry } from "./types.js";

export class AutonomyLogger {
  readonly runId: string;
  private readonly items: AutonomyRunLogEntry[];

  constructor(runId = randomUUID(), seed: AutonomyRunLogEntry[] = []) {
    this.runId = runId;
    this.items = [...seed];
  }

  info(message: string, data?: Record<string, unknown>) {
    this.push("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.push("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>) {
    this.push("error", message, data);
  }

  snapshot(): AutonomyRunLogEntry[] {
    return [...this.items];
  }

  private push(level: AutonomyRunLogEntry["level"], message: string, data?: Record<string, unknown>) {
    this.items.push({
      level,
      message,
      timestamp: new Date().toISOString(),
      data
    });
  }
}
