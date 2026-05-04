import { Injectable, Logger } from "@nestjs/common";

export type EmbeddingVector = number[];

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

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly openaiKey = process.env.OPENAI_API_KEY;
  private readonly model = "text-embedding-3-small";
  private readonly dim = 1536;

  get isAvailable(): boolean {
    return typeof this.openaiKey === "string" && this.openaiKey.length > 10;
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    if (!this.isAvailable) {
      this.logger.warn("[embed] OpenAI key not set — returning zero vectors");
      return texts.map(() => new Array(this.dim).fill(0) as number[]);
    }

    const inputs = texts.map((t) => t.slice(0, 8000)); // token safety
    try {
      const resp = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.openaiKey}`,
        },
        body: JSON.stringify({ model: this.model, input: inputs }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`OpenAI embeddings HTTP ${resp.status}: ${err.slice(0, 200)}`);
      }

      const json = (await resp.json()) as { data: Array<{ embedding: number[] }> };
      return json.data.map((d) => d.embedding);
    } catch (err) {
      this.logger.error(`[embed] batch failed: ${err instanceof Error ? err.message : String(err)}`);
      return texts.map(() => new Array(this.dim).fill(0) as number[]);
    }
  }

  async embed(text: string): Promise<EmbeddingVector> {
    const [vec] = await this.embedBatch([text]);
    return vec ?? new Array(this.dim).fill(0) as number[];
  }
}
