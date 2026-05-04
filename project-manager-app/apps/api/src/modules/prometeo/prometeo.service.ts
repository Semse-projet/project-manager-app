import { Injectable, Logger } from "@nestjs/common";
import { ChunkerService } from "./chunker.service.js";
import { EmbeddingService, cosineSimilarity, type EmbeddingVector } from "./embedding.service.js";
import { PrometeoRepository, type PrometeoChunkSearchRow, type PrometeoDocumentRecord } from "./prometeo.repository.js";

export type SearchResult = {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  text: string;
  score: number;
};

type ScoredChunk = {
  documentId: string;
  chunkIndex: number;
  text: string;
  score: number;
};

export type RagContext = {
  chunks: SearchResult[];
  contextBlock: string;
  tokenEstimate: number;
};

const BATCH_SIZE = 20;
const MAX_CONTEXT_CHARS = 6_000;

@Injectable()
export class PrometeoService {
  private readonly logger = new Logger(PrometeoService.name);

  constructor(
    private readonly repo: PrometeoRepository,
    private readonly chunker: ChunkerService,
    private readonly embedding: EmbeddingService,
  ) {}

  // ── Ingest ──────────────────────────────────────────────────────────────────

  async ingestText(input: {
    tenantId: string; orgId: string; userId: string;
    projectId?: string; title: string;
    text: string; sourceType?: string; sourceRef?: string;
    metadataJson?: Record<string, unknown>;
  }): Promise<PrometeoDocumentRecord> {
    const doc = await this.repo.createDocument({
      tenantId: input.tenantId, orgId: input.orgId, projectId: input.projectId,
      title: input.title, sourceType: input.sourceType ?? "text",
      sourceRef: input.sourceRef, uploadedById: input.userId,
      metadataJson: input.metadataJson,
    });

    // Process async — return immediately with pending status
    void this.processDocument(doc.id, input.tenantId, input.text);
    return doc;
  }

  private async processDocument(docId: string, tenantId: string, text: string): Promise<void> {
    try {
      const rawChunks = this.chunker.chunk(text);
      if (!rawChunks.length) { await this.repo.markFailed(docId, "Empty text after chunking"); return; }

      // Batch embed
      const allEmbeddings: EmbeddingVector[] = [];
      for (let i = 0; i < rawChunks.length; i += BATCH_SIZE) {
        const batch = rawChunks.slice(i, i + BATCH_SIZE);
        const vecs = await this.embedding.embedBatch(batch.map((c) => c.text));
        allEmbeddings.push(...vecs);
      }

      await this.repo.saveChunks(docId, tenantId, rawChunks.map((c, i) => ({
        index: c.index, text: c.text, tokenCount: c.tokenCount,
        embedding: allEmbeddings[i] ?? [],
        metadata: c.metadata,
      })));
      await this.repo.markIndexed(docId, rawChunks.length);
      this.logger.log(`[prometeo] indexed doc=${docId} chunks=${rawChunks.length} embed=${this.embedding.isAvailable ? "real" : "zero"}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[prometeo] processing failed doc=${docId}: ${msg}`);
      await this.repo.markFailed(docId, msg);
    }
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  async search(input: {
    tenantId: string; projectId?: string; query: string; topK?: number;
  }): Promise<SearchResult[]> {
    const topK = input.topK ?? 5;
    const queryVec = await this.embedding.embed(input.query);

    const chunks = await this.repo.loadChunksForSearch({ tenantId: input.tenantId, projectId: input.projectId });
    if (!chunks.length) return [];

    const scored: ScoredChunk[] = chunks.map((c: PrometeoChunkSearchRow) => {
      const vec = Array.isArray(c.embeddingJson) ? (c.embeddingJson as EmbeddingVector) : [];
      const score = vec.length > 0 ? cosineSimilarity(queryVec, vec) : this.ftsScore(c.text, input.query);
      return { documentId: c.documentId, chunkIndex: c.chunkIndex, text: c.text, score };
    });

    scored.sort((a: ScoredChunk, b: ScoredChunk) => b.score - a.score);
    const top = scored.slice(0, topK);

    const uniqueDocIds = [...new Set(top.map((r: ScoredChunk) => r.documentId))];
    const titleMap = await this.repo.getDocumentTitles(uniqueDocIds);
    return top.map((r: ScoredChunk) => ({ ...r, documentTitle: titleMap.get(r.documentId) ?? "—" }));
  }

  // Fallback when embeddings are zero vectors: keyword overlap score
  private ftsScore(text: string, query: string): number {
    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (!words.length) return 0;
    const lower = text.toLowerCase();
    const hits = words.filter((w) => lower.includes(w)).length;
    return hits / words.length;
  }

  // ── RAG context builder ─────────────────────────────────────────────────────

  async buildRagContext(input: {
    tenantId: string; projectId?: string; query: string; topK?: number;
  }): Promise<RagContext> {
    const results = await this.search({ ...input, topK: input.topK ?? 6 });
    if (!results.length) return { chunks: [], contextBlock: "", tokenEstimate: 0 };

    const lines: string[] = ["## Contexto documental (Prometeo RAG)"];
    let total = 0;

    for (const r of results) {
      const excerpt = r.text.slice(0, 600);
      const block = `### ${r.documentTitle}\n${excerpt}`;
      if (total + block.length > MAX_CONTEXT_CHARS) break;
      lines.push(block);
      total += block.length;
    }

    return {
      chunks: results,
      contextBlock: lines.join("\n\n"),
      tokenEstimate: Math.ceil(total / 4),
    };
  }

  // ── Document management ─────────────────────────────────────────────────────

  async listDocuments(tenantId: string, projectId?: string) {
    return this.repo.listDocuments({ tenantId, projectId });
  }

  async deleteDocument(id: string) {
    return this.repo.deleteDocument(id);
  }

  // ── Assets ──────────────────────────────────────────────────────────────────

  async createAsset(input: Parameters<PrometeoRepository["createAsset"]>[0]) {
    return this.repo.createAsset(input);
  }

  async listAssets(input: Parameters<PrometeoRepository["listAssets"]>[0]) {
    return this.repo.listAssets(input);
  }

  async updateAssetStatus(id: string, status: string) {
    return this.repo.updateAssetStatus(id, status);
  }

  // ── Work Orders ─────────────────────────────────────────────────────────────

  async createWorkOrder(input: Parameters<PrometeoRepository["createWorkOrder"]>[0]) {
    return this.repo.createWorkOrder(input);
  }

  async listWorkOrders(input: Parameters<PrometeoRepository["listWorkOrders"]>[0]) {
    return this.repo.listWorkOrders(input);
  }

  async updateWorkOrderStatus(id: string, status: string) {
    return this.repo.updateWorkOrderStatus(id, status);
  }
}
