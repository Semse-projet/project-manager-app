import { Injectable, Logger } from "@nestjs/common";
import type { LLMProviderName, TaskType } from "../types.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLLING_WINDOW = 50;              // max samples per (provider, taskType)
const CIRCUIT_OPEN_THRESHOLD = 3;       // consecutive failures to open circuit
const CIRCUIT_HALF_OPEN_MS = 30_000;    // 30s before retrying
const DEFAULT_ASSUMED_SUCCESS_RATE = 0.8;
const COST_PER_1K: Record<LLMProviderName, number> = {
  anthropic: 0.003,   // claude-sonnet approx input $/1K tokens
  openai:    0.002,   // gpt-4.1 approx
  ollama:    0.000,   // local
  template:  0.000,
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProviderSnapshot = {
  provider: LLMProviderName;
  taskType: TaskType;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  successRate: number;
  estimatedCostPer1K: number;
  score: number;
  circuitState: "closed" | "open" | "half-open";
  lastFailureAt?: string;
  sampleCount: number;
};

type MetricBucket = {
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  lastFailureAt: number | undefined;
  latencySamples: number[];   // rolling window
  tokenSamples: number[];     // rolling window of total tokens
};

function makeKey(provider: LLMProviderName, taskType: TaskType): string {
  return `${provider}:${taskType}`;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
  return sorted[idx] ?? 0;
}

// ── Store ─────────────────────────────────────────────────────────────────────

@Injectable()
export class ProviderMetricsStore {
  private readonly logger = new Logger(ProviderMetricsStore.name);
  private readonly buckets = new Map<string, MetricBucket>();

  // ── Write ──────────────────────────────────────────────────────────────────

  recordSuccess(
    provider: LLMProviderName,
    taskType: TaskType,
    latencyMs: number,
    totalTokens: number,
  ): void {
    const key = makeKey(provider, taskType);
    const bucket = this.getOrCreate(key);

    bucket.successCount++;
    bucket.consecutiveFailures = 0;

    // Rolling window
    bucket.latencySamples.push(latencyMs);
    bucket.tokenSamples.push(totalTokens);
    if (bucket.latencySamples.length > ROLLING_WINDOW) bucket.latencySamples.shift();
    if (bucket.tokenSamples.length > ROLLING_WINDOW) bucket.tokenSamples.shift();

    this.logger.debug(
      `[metrics] ✓ ${provider}:${taskType} latency=${latencyMs}ms tokens=${totalTokens}`,
    );
  }

  recordFailure(provider: LLMProviderName, taskType: TaskType, reason: string): void {
    const key = makeKey(provider, taskType);
    const bucket = this.getOrCreate(key);

    bucket.failureCount++;
    bucket.consecutiveFailures++;
    bucket.lastFailureAt = Date.now();

    if (bucket.consecutiveFailures >= CIRCUIT_OPEN_THRESHOLD) {
      this.logger.warn(
        `[metrics] ⚡ circuit OPEN: ${provider}:${taskType} consecutive=${bucket.consecutiveFailures} reason=${reason}`,
      );
    } else {
      this.logger.debug(`[metrics] ✗ ${provider}:${taskType} reason=${reason}`);
    }
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  isCircuitOpen(provider: LLMProviderName, taskType: TaskType): boolean {
    const bucket = this.buckets.get(makeKey(provider, taskType));
    if (!bucket) return false;
    if (bucket.consecutiveFailures < CIRCUIT_OPEN_THRESHOLD) return false;

    const age = Date.now() - (bucket.lastFailureAt ?? 0);
    if (age >= CIRCUIT_HALF_OPEN_MS) {
      // Half-open: allow one probe
      bucket.consecutiveFailures = Math.max(0, CIRCUIT_OPEN_THRESHOLD - 1);
      this.logger.log(`[metrics] 🔄 circuit HALF-OPEN: ${provider}:${taskType}`);
      return false;
    }
    return true;
  }

  score(provider: LLMProviderName, taskType: TaskType): number {
    const bucket = this.buckets.get(makeKey(provider, taskType));
    if (!bucket) return DEFAULT_ASSUMED_SUCCESS_RATE * 100; // unknown → assume decent

    const total = bucket.successCount + bucket.failureCount;
    if (total === 0) return DEFAULT_ASSUMED_SUCCESS_RATE * 100;

    const successRate = bucket.successCount / total;
    const sorted = [...bucket.latencySamples].sort((a, b) => a - b);
    const avgLatency = sorted.length > 0
      ? sorted.reduce((s, v) => s + v, 0) / sorted.length
      : 2000;

    // Score = successRate^2 * 1000 / (latency_s + 1)
    // Range roughly 0–1000. Higher is better.
    return (successRate ** 2 * 1000) / (avgLatency / 1000 + 1);
  }

  snapshot(provider: LLMProviderName, taskType: TaskType): ProviderSnapshot {
    const bucket = this.buckets.get(makeKey(provider, taskType));
    const total = (bucket?.successCount ?? 0) + (bucket?.failureCount ?? 0);
    const successRate = total > 0 ? (bucket?.successCount ?? 0) / total : DEFAULT_ASSUMED_SUCCESS_RATE;
    const sorted = [...(bucket?.latencySamples ?? [])].sort((a, b) => a - b);
    const avgLatencyMs = sorted.length > 0 ? sorted.reduce((s, v) => s + v, 0) / sorted.length : 0;
    const p95LatencyMs = percentile(sorted, 0.95);

    const consecutiveFailures = bucket?.consecutiveFailures ?? 0;
    const lastFailureAt = bucket?.lastFailureAt;
    const isOpen = consecutiveFailures >= CIRCUIT_OPEN_THRESHOLD &&
      (Date.now() - (lastFailureAt ?? 0)) < CIRCUIT_HALF_OPEN_MS;
    const isHalfOpen = consecutiveFailures >= CIRCUIT_OPEN_THRESHOLD && !isOpen;

    return {
      provider,
      taskType,
      successCount: bucket?.successCount ?? 0,
      failureCount: bucket?.failureCount ?? 0,
      consecutiveFailures,
      avgLatencyMs: Math.round(avgLatencyMs),
      p95LatencyMs: Math.round(p95LatencyMs),
      successRate: Math.round(successRate * 1000) / 1000,
      estimatedCostPer1K: COST_PER_1K[provider],
      score: Math.round(this.score(provider, taskType) * 10) / 10,
      circuitState: isOpen ? "open" : isHalfOpen ? "half-open" : "closed",
      lastFailureAt: lastFailureAt ? new Date(lastFailureAt).toISOString() : undefined,
      sampleCount: bucket?.latencySamples.length ?? 0,
    };
  }

  allSnapshots(): ProviderSnapshot[] {
    const snapshots: ProviderSnapshot[] = [];
    for (const key of this.buckets.keys()) {
      const [provider, taskType] = key.split(":") as [LLMProviderName, TaskType];
      snapshots.push(this.snapshot(provider, taskType));
    }
    return snapshots.sort((a, b) => b.score - a.score);
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private getOrCreate(key: string): MetricBucket {
    if (!this.buckets.has(key)) {
      this.buckets.set(key, {
        successCount: 0,
        failureCount: 0,
        consecutiveFailures: 0,
        lastFailureAt: undefined,
        latencySamples: [],
        tokenSamples: [],
      });
    }
    return this.buckets.get(key)!;
  }
}
