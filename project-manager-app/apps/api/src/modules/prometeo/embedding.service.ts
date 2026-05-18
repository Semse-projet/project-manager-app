import { Injectable, Logger } from "@nestjs/common";

export type EmbeddingVector = number[];

export type EmbeddingProviderHealth = {
  provider: string;
  model: string;
  available: boolean;
  latencyMs?: number;
  error?: string;
};

export type EmbeddingStats = {
  provider: string;
  model: string;
  available: boolean;
  successCount: number;
  failureCount: number;
  fallbackCount: number;
  avgLatencyMs: number;
  lastErrorAt?: string;
  lastError?: string;
};

// Cosine similarity between two equal-length vectors
export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/** Returns true if the vector is all zeros (placeholder / embedding failed). */
export function isZeroVector(vec: EmbeddingVector): boolean {
  if (!vec || vec.length === 0) return true;
  return vec.every((v) => v === 0);
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly openaiKey = process.env.OPENAI_API_KEY;
  private readonly model = process.env.EMBEDDINGS_MODEL ?? "text-embedding-3-small";
  private readonly dim = parseInt(process.env.EMBEDDINGS_DIMENSIONS ?? "1536", 10);
  private readonly batchSize = parseInt(process.env.EMBEDDINGS_BATCH_SIZE ?? "32", 10);
  private readonly timeoutMs = parseInt(process.env.EMBEDDINGS_TIMEOUT_MS ?? "30000", 10);

  // ── Stats ────────────────────────────────────────────────────────────────────
  private successCount = 0;
  private failureCount = 0;
  private fallbackCount = 0;
  private totalLatencyMs = 0;
  private lastErrorAt?: string;
  private lastError?: string;

  get isAvailable(): boolean {
    return typeof this.openaiKey === "string" && this.openaiKey.length > 10;
  }

  getStats(): EmbeddingStats {
    const calls = this.successCount + this.failureCount;
    return {
      provider:      this.isAvailable ? "openai" : "none",
      model:         this.model,
      available:     this.isAvailable,
      successCount:  this.successCount,
      failureCount:  this.failureCount,
      fallbackCount: this.fallbackCount,
      avgLatencyMs:  calls > 0 ? Math.round(this.totalLatencyMs / calls) : 0,
      lastErrorAt:   this.lastErrorAt,
      lastError:     this.lastError,
    };
  }

  async healthCheck(): Promise<EmbeddingProviderHealth> {
    if (!this.isAvailable) {
      return { provider: "none", model: this.model, available: false, error: "OPENAI_API_KEY not set" };
    }

    const start = Date.now();
    try {
      const vec = await this.embedBatch(["health check"]);
      const ok = vec.length > 0 && !isZeroVector(vec[0]!);
      return {
        provider:  "openai",
        model:     this.model,
        available: ok,
        latencyMs: Date.now() - start,
        error:     ok ? undefined : "Embedding returned zero vector",
      };
    } catch (err) {
      return {
        provider:  "openai",
        model:     this.model,
        available: false,
        latencyMs: Date.now() - start,
        error:     err instanceof Error ? err.message : String(err),
      };
    }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    if (!this.isAvailable) {
      this.logger.warn("[embed] OPENAI_API_KEY not set — returning zero vectors (FTS fallback will activate)");
      this.fallbackCount += texts.length;
      return texts.map(() => new Array(this.dim).fill(0) as number[]);
    }

    const inputs = texts.map((t) => t.slice(0, 8000));
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const resp = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.openaiKey}`,
        },
        body: JSON.stringify({ model: this.model, input: inputs }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`OpenAI embeddings HTTP ${resp.status}: ${err.slice(0, 200)}`);
      }

      const json = (await resp.json()) as { data: Array<{ embedding: number[] }> };
      const latency = Date.now() - start;
      this.successCount += texts.length;
      this.totalLatencyMs += latency;
      this.logger.debug(`[embed] batch=${texts.length} model=${this.model} latency=${latency}ms`);
      return json.data.map((d) => d.embedding);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[embed] batch failed: ${msg} — returning zero vectors`);
      this.failureCount += texts.length;
      this.fallbackCount += texts.length;
      this.lastError = msg;
      this.lastErrorAt = new Date().toISOString();
      return texts.map(() => new Array(this.dim).fill(0) as number[]);
    }
  }

  async embed(text: string): Promise<EmbeddingVector> {
    const [vec] = await this.embedBatch([text]);
    return vec ?? (new Array(this.dim).fill(0) as number[]);
  }
}
