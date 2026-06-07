import { Injectable, Logger } from "@nestjs/common";
import { ChunkerService } from "./chunker.service.js";
import { DocumentParserService } from "./document-parser.service.js";
import { EmbeddingService, cosineSimilarity, isZeroVector, type EmbeddingVector } from "./embedding.service.js";
import { PrometeoRepository, type PrometeoChunkSearchRow, type PrometeoDocumentRecord } from "./prometeo.repository.js";

export type RetrievalMode = "hybrid" | "semantic" | "fts_fallback";

export type SearchResult = {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  chunkId: string;
  text: string;
  score: number;           // final hybrid score (semantic + FTS + feedback boost)
  semanticScore?: number;  // cosine similarity (undefined if fts_fallback)
  textScore?: number;      // FTS keyword score
  feedbackScore?: number;  // human feedback score ∈ [-1, 1], 0 = no feedback
  retrievalMode: RetrievalMode;
};

type ScoredChunk = {
  documentId: string;
  chunkId: string;
  chunkIndex: number;
  text: string;
  score: number;
  semanticScore?: number;
  textScore?: number;
  feedbackScore?: number;
  retrievalMode: RetrievalMode;
};

export type RagContext = {
  chunks: SearchResult[];
  contextBlock: string;
  tokenEstimate: number;
};

export type EmbeddingRagHealth = {
  embeddingsProvider: string;
  embeddingsModel: string;
  embeddingsAvailable: boolean;
  embeddingsHealthy: boolean;
  totalDocuments: number;
  totalChunks: number;
  chunksWithEmbeddings: number;
  chunksMissingEmbeddings: number;
  avgEmbeddingLatencyMs: number;
  fallbackCount: number;
  successCount: number;
  failureCount: number;
  lastEmbeddingError?: string;
  retrievalMode: RetrievalMode;
};

// Hybrid scoring weights
const SEMANTIC_WEIGHT  = 0.70;
const FTS_WEIGHT       = 0.30;
const FEEDBACK_WEIGHT  = 0.15; // additive boost/penalty ∈ [-0.15, +0.15]
const BATCH_SIZE = 20;
const MAX_CONTEXT_CHARS = 6_000;

@Injectable()
export class PrometeoService {
  private readonly logger = new Logger(PrometeoService.name);

  constructor(
    private readonly repo: PrometeoRepository,
    private readonly chunker: ChunkerService,
    private readonly embedding: EmbeddingService,
    private readonly parser: DocumentParserService,
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

  /** Ingest a file buffer (PDF/DOCX/TXT/Markdown) — parse, chunk, embed, index. */
  async ingestFile(input: {
    tenantId: string; orgId: string; userId: string;
    title: string; fileBuffer: Buffer; mimeType: string; fileName: string;
    sourceType?: string; trade?: string; visibility?: string;
    projectId?: string; metadataJson?: Record<string, unknown>;
  }): Promise<PrometeoDocumentRecord & { parseWarnings?: string[] }> {
    // 1. Create doc record with status=parsing
    const doc = await this.repo.createDocument({
      tenantId: input.tenantId, orgId: input.orgId, projectId: input.projectId,
      title: input.title,
      sourceType: input.mimeType.startsWith("application/pdf") ? "pdf"
        : input.mimeType.includes("word") ? "docx" : "text",
      uploadedById: input.userId,
      metadataJson: {
        ...input.metadataJson,
        originalFileName: input.fileName,
        mimeType: input.mimeType,
        trade: input.trade ?? "general",
        visibility: input.visibility ?? "public_training",
        status: "parsing",
      },
    });

    // 2. Parse + chunk + embed async
    void this.processFileDocument(doc.id, input.tenantId, input.fileBuffer, input.mimeType, input.fileName);
    return { ...doc, parseWarnings: [] };
  }

  private async processFileDocument(
    docId: string, tenantId: string,
    buffer: Buffer, mimeType: string, fileName: string,
  ): Promise<void> {
    try {
      const parsed = await this.parser.parseBuffer(buffer, mimeType, fileName);

      if (!parsed.text || parsed.charCount < 10) {
        const warning = parsed.warnings[0] ?? "No se pudo extraer texto";
        await this.repo.markFailed(docId, warning);
        return;
      }

      await this.processDocument(docId, tenantId, parsed.text);

      // Update metadataJson with parse info
      await this.repo.updateMetadata(docId, {
        pageCount: parsed.pageCount,
        parser: parsed.parser,
        charCount: parsed.charCount,
        parseWarnings: parsed.warnings,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[prometeo] file processing failed doc=${docId}: ${msg}`);
      await this.repo.markFailed(docId, msg);
    }
  }

  /** Get document counts organized by trade for the library view. */
  async getTradeLibrary(tenantId: string) {
    const docs = await this.repo.listDocuments({ tenantId });
    const trades = [
      "electrical", "plumbing", "drywall", "painting", "carpentry",
      "hvac", "siding", "demolition", "cleaning", "bathroom", "kitchen",
      "windows_doors", "general",
    ];
    const LABELS: Record<string, string> = {
      electrical: "Electricidad", plumbing: "Plomería", drywall: "Drywall",
      painting: "Pintura", carpentry: "Carpintería", hvac: "HVAC",
      siding: "Siding", demolition: "Demolición", cleaning: "Limpieza",
      bathroom: "Baños", kitchen: "Cocinas", windows_doors: "Ventanas/Puertas",
      general: "General",
    };

    return trades.map((trade) => {
      const tradeDocs = docs.filter((d) => {
        const meta = (d.metadataJson ?? {}) as Record<string, unknown>;
        return (meta.trade ?? "general") === trade;
      });
      const indexed = tradeDocs.filter((d) => d.status === "indexed");
      return {
        trade,
        label: LABELS[trade] ?? trade,
        documentsCount: tradeDocs.length,
        indexedCount:   indexed.length,
        chunksCount:    indexed.reduce((s, d) => s + d.chunkCount, 0),
        lastIndexedAt:  indexed.length > 0 ? indexed[0]?.updatedAt?.toISOString() : null,
        types:          [...new Set(tradeDocs.map((d) => d.sourceType))],
      };
    });
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  async search(input: {
    tenantId: string; projectId?: string; query: string; topK?: number;
    trade?: string;
  }): Promise<SearchResult[]> {
    const topK = input.topK ?? 5;
    const queryVec = await this.embedding.embed(input.query);
    const hasRealQueryEmbedding = !isZeroVector(queryVec);

    const chunks = await this.repo.loadChunksForSearch({ tenantId: input.tenantId, projectId: input.projectId });
    if (!chunks.length) return [];

    // Load feedback scores for all chunks (only when feedback data exists)
    const chunkIds = chunks.map((c: PrometeoChunkSearchRow) => c.id);
    const feedbackMap = await this.repo.getFeedbackScores(input.tenantId, chunkIds);

    const scored: ScoredChunk[] = chunks.map((c: PrometeoChunkSearchRow) => {
      const vec = Array.isArray(c.embeddingJson) ? (c.embeddingJson as EmbeddingVector) : [];
      const hasRealChunkEmbedding = vec.length > 0 && !isZeroVector(vec);

      const textScore     = this.ftsScore(c.text, input.query);
      const feedbackScore = feedbackMap.get(c.id) ?? 0;

      let semanticScore: number | undefined;
      let baseScore: number;
      let retrievalMode: RetrievalMode;

      if (hasRealQueryEmbedding && hasRealChunkEmbedding) {
        semanticScore = cosineSimilarity(queryVec, vec);
        baseScore     = SEMANTIC_WEIGHT * semanticScore + FTS_WEIGHT * textScore;
        retrievalMode = "hybrid";
      } else {
        // Zero-vector detected — use FTS only (critical bug fix)
        baseScore     = textScore;
        retrievalMode = "fts_fallback";
      }

      // Additive feedback boost: confirmed chunks rank higher, flagged chunks rank lower
      const score = baseScore + FEEDBACK_WEIGHT * feedbackScore;

      return { documentId: c.documentId, chunkId: c.id, chunkIndex: c.chunkIndex, text: c.text,
               score, semanticScore, textScore, feedbackScore: feedbackScore || undefined, retrievalMode };
    });

    // Filter by trade if specified (best-effort via metadataJson)
    const filtered = input.trade
      ? scored.filter((c) => {
          const raw = chunks.find((ch) => ch.documentId === c.documentId && ch.chunkIndex === c.chunkIndex);
          const meta = raw?.metadataJson as Record<string, unknown> | null | undefined;
          return !meta?.trade || meta.trade === input.trade || meta.trade === "general";
        })
      : scored;

    const sorted = (filtered.length > 0 ? filtered : scored)
      .sort((a: ScoredChunk, b: ScoredChunk) => b.score - a.score);
    const top = sorted.slice(0, topK);

    const uniqueDocIds = [...new Set(top.map((r: ScoredChunk) => r.documentId))];
    const titleMap = await this.repo.getDocumentTitles(uniqueDocIds);
    return top.map((r: ScoredChunk) => ({ ...r, documentTitle: titleMap.get(r.documentId) ?? "—" }));
  }

  // ── Human Feedback ────────────────────────────────────────────────────────

  async submitFeedback(input: {
    tenantId: string; userId: string;
    chunkId: string;
    type: "confirm" | "correct" | "flag";
    note?: string;
    query?: string;
    tradeTag?: string;
  }) {
    const VALID_TYPES = ["confirm", "correct", "flag"] as const;
    if (!VALID_TYPES.includes(input.type)) {
      throw new Error(`Invalid feedback type '${input.type}'. Must be: confirm | correct | flag`);
    }

    const chunk = await this.repo.getChunkById(input.tenantId, input.chunkId);
    if (!chunk) {
      throw new Error(`Chunk '${input.chunkId}' not found in tenant '${input.tenantId}'`);
    }

    return this.repo.saveFeedback({
      tenantId: input.tenantId,
      chunkId: input.chunkId,
      documentId: chunk.documentId,
      userId: input.userId,
      type: input.type,
      note: input.note,
      query: input.query,
      tradeTag: input.tradeTag,
    });
  }

  async getFeedbackStats(tenantId: string) {
    return this.repo.getFeedbackStats(tenantId);
  }

  /** Keyword overlap score — used as FTS fallback and hybrid component. */
  private ftsScore(text: string, query: string): number {
    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    if (!words.length) return 0;
    const lower = text.toLowerCase();
    const hits = words.filter((w) => lower.includes(w)).length;
    return hits / words.length;
  }

  /** Embedding health + RAG stats for Mission Control. */
  async getEmbeddingRagHealth(tenantId: string): Promise<EmbeddingRagHealth> {
    const stats = this.embedding.getStats();
    const docs = await this.repo.listDocuments({ tenantId });
    const totalDocs = docs.length;
    const indexedDocs = docs.filter((d) => d.status === "indexed");
    const totalChunks = indexedDocs.reduce((s, d) => s + d.chunkCount, 0);

    // Sample chunks to count real vs zero embeddings
    const sampleChunks = await this.repo.loadChunksForSearch({ tenantId, limit: 200 });
    const withEmbeddings = sampleChunks.filter((c) => {
      const vec = Array.isArray(c.embeddingJson) ? (c.embeddingJson as EmbeddingVector) : [];
      return vec.length > 0 && !isZeroVector(vec);
    }).length;
    const missingEmbeddings = sampleChunks.length - withEmbeddings;

    const retrievalMode: RetrievalMode = stats.available && withEmbeddings > 0 ? "hybrid" : "fts_fallback";

    return {
      embeddingsProvider:      stats.provider,
      embeddingsModel:         stats.model,
      embeddingsAvailable:     stats.available,
      embeddingsHealthy:       stats.available && stats.failureCount === 0,
      totalDocuments:          totalDocs,
      totalChunks,
      chunksWithEmbeddings:    withEmbeddings,
      chunksMissingEmbeddings: missingEmbeddings,
      avgEmbeddingLatencyMs:   stats.avgLatencyMs,
      fallbackCount:           stats.fallbackCount,
      successCount:            stats.successCount,
      failureCount:            stats.failureCount,
      lastEmbeddingError:      stats.lastError,
      retrievalMode,
    };
  }

  /** Backfill zero-vector chunks with real embeddings. Safe to run multiple times (idempotent). */
  async backfillEmbeddings(input: {
    tenantId?: string;
    batchSize?: number;
    dryRun?: boolean;
  }): Promise<{
    total: number;
    alreadyEmbedded: number;
    embedded: number;
    failed: number;
    dryRun: boolean;
    provider: string;
  }> {
    const batchSize = input.batchSize ?? 16;
    const dryRun = input.dryRun ?? false;
    const stats = this.embedding.getStats();

    if (!stats.available && !dryRun) {
      throw new Error("EmbeddingService not available — OPENAI_API_KEY not configured");
    }

    // Load all indexed docs
    const docs = await this.repo.listDocuments({ tenantId: input.tenantId ?? "tenant_default" });
    const indexed = docs.filter((d) => d.status === "indexed");

    if (!indexed.length) {
      return { total: 0, alreadyEmbedded: 0, embedded: 0, failed: 0, dryRun, provider: stats.provider };
    }

    // Load all chunks for indexed docs
    const allChunks = await this.repo.loadChunksForSearch({
      tenantId: input.tenantId ?? "tenant_default",
      limit: 5000,
    });

    const needsEmbedding = allChunks.filter((c) => {
      const vec = Array.isArray(c.embeddingJson) ? (c.embeddingJson as EmbeddingVector) : [];
      return isZeroVector(vec);
    });

    const alreadyEmbedded = allChunks.length - needsEmbedding.length;

    if (!needsEmbedding.length || dryRun) {
      return { total: allChunks.length, alreadyEmbedded, embedded: 0, failed: 0, dryRun, provider: stats.provider };
    }

    let embedded = 0;
    let failed = 0;

    for (let i = 0; i < needsEmbedding.length; i += batchSize) {
      const batch = needsEmbedding.slice(i, i + batchSize);
      const texts = batch.map((c) => c.text);

      try {
        const vectors = await this.embedding.embedBatch(texts);

        // Update each chunk via repository
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j]!;
          const vec = vectors[j] ?? [];
          if (!isZeroVector(vec)) {
            await this.repo.updateChunkEmbedding(chunk.documentId, chunk.chunkIndex, vec);
            embedded++;
          } else {
            failed++;
          }
        }
      } catch {
        failed += batch.length;
      }
    }

    this.logger.log(`[backfill] done — embedded=${embedded} failed=${failed} total=${allChunks.length}`);
    return { total: allChunks.length, alreadyEmbedded, embedded, failed, dryRun, provider: stats.provider };
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

  /**
   * Agent-facing API: retrieve relevant document context for a query.
   * Returns contextBlock (for prompt injection) + citations.
   * Safe to call with @Optional injection — returns empty if no indexed docs.
   */
  async retrieveContext(input: {
    query:      string;
    tenantId:   string;
    projectId?: string;
    trade?:     string;
    topK?:      number;
  }): Promise<{
    available:    boolean;
    contextBlock: string;
    citations:    Array<{ documentId: string; documentTitle: string; excerpt: string; score: number }>;
  }> {
    try {
      const ctx = await this.buildRagContext({ tenantId: input.tenantId, projectId: input.projectId, query: input.query, topK: input.topK ?? 4 });
      if (!ctx.chunks.length) return { available: false, contextBlock: "", citations: [] };

      // Filter by trade if specified
      const filtered = input.trade
        ? ctx.chunks.filter((c) => {
            const meta = c as Record<string, unknown> & { metadataJson?: unknown };
            const m = meta.metadataJson as Record<string, unknown> | undefined;
            return !m?.trade || m.trade === input.trade || m.trade === "general";
          })
        : ctx.chunks;

      if (!filtered.length) return { available: false, contextBlock: "", citations: [] };

      const citations = filtered.slice(0, 4).map((c) => ({
        documentId:    c.documentId,
        documentTitle: c.documentTitle,
        excerpt:       c.text.slice(0, 150),
        score:         c.score,
      }));

      const contextLines = ["## Contexto documental (Prometeo RAG)", ...filtered.slice(0, 4).map((c) => `### ${c.documentTitle}\n${c.text.slice(0, 500)}`)];
      return { available: true, contextBlock: contextLines.join("\n\n"), citations };
    } catch (err) {
      this.logger.warn(`[prometeo] retrieveContext failed: ${(err as Error).message}`);
      return { available: false, contextBlock: "", citations: [] };
    }
  }

  // ── Document management ─────────────────────────────────────────────────────

  async listDocuments(tenantId: string, projectId?: string) {
    return this.repo.listDocuments({ tenantId, projectId });
  }

  async deleteDocument(input: { tenantId: string; id: string }) {
    return this.repo.deleteDocument(input);
  }

  // ── Assets ──────────────────────────────────────────────────────────────────

  async createAsset(input: Parameters<PrometeoRepository["createAsset"]>[0]) {
    return this.repo.createAsset(input);
  }

  async listAssets(input: Parameters<PrometeoRepository["listAssets"]>[0]) {
    return this.repo.listAssets(input);
  }

  async updateAssetStatus(input: { tenantId: string; id: string; status: string }) {
    return this.repo.updateAssetStatus(input);
  }

  // ── Work Orders ─────────────────────────────────────────────────────────────

  async createWorkOrder(input: Parameters<PrometeoRepository["createWorkOrder"]>[0]) {
    return this.repo.createWorkOrder(input);
  }

  async listWorkOrders(input: Parameters<PrometeoRepository["listWorkOrders"]>[0]) {
    return this.repo.listWorkOrders(input);
  }

  async updateWorkOrderStatus(input: { tenantId: string; id: string; status: string }) {
    return this.repo.updateWorkOrderStatus(input);
  }
}
