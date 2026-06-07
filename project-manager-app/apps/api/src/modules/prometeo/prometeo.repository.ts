import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { EmbeddingVector } from "./embedding.service.js";

export type PrometeoDocumentRecord = {
  id: string; tenantId: string; orgId: string; projectId: string | null;
  title: string; sourceType: string; sourceRef: string | null;
  status: string; chunkCount: number; uploadedById: string;
  errorMsg: string | null; metadataJson: unknown; createdAt: Date; updatedAt: Date;
};

export type PrometeoChunkSearchRow = {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  embeddingJson: unknown;
  metadataJson: unknown;
};

@Injectable()
export class PrometeoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createDocument(input: {
    tenantId: string; orgId: string; projectId?: string; title: string;
    sourceType: string; sourceRef?: string; uploadedById: string;
    metadataJson?: Record<string, unknown>;
  }): Promise<PrometeoDocumentRecord> {
    return this.prisma.prometeoDocument.create({
      data: {
        tenantId: input.tenantId, orgId: input.orgId, projectId: input.projectId,
        title: input.title, sourceType: input.sourceType, sourceRef: input.sourceRef,
        uploadedById: input.uploadedById, metadataJson: (input.metadataJson ?? {}) as unknown as import("@prisma/client").Prisma.InputJsonValue,
        status: "processing",
      },
    }) as Promise<PrometeoDocumentRecord>;
  }

  async saveChunks(documentId: string, tenantId: string,
    chunks: Array<{ index: number; text: string; tokenCount: number; embedding: EmbeddingVector; metadata: unknown }>,
  ): Promise<void> {
    await this.prisma.documentChunk.createMany({
      data: chunks.map((c) => ({
        tenantId, documentId, chunkIndex: c.index, text: c.text,
        tokenCount: c.tokenCount, embeddingJson: c.embedding as unknown as object,
        metadataJson: c.metadata as object,
      })),
    });
  }

  async markIndexed(documentId: string, chunkCount: number): Promise<void> {
    await this.prisma.prometeoDocument.update({ where: { id: documentId }, data: { status: "indexed", chunkCount, updatedAt: new Date() } });
  }

  async markFailed(documentId: string, error: string): Promise<void> {
    await this.prisma.prometeoDocument.update({ where: { id: documentId }, data: { status: "failed", errorMsg: error.slice(0, 500), updatedAt: new Date() } });
  }

  async updateMetadata(documentId: string, extra: Record<string, unknown>): Promise<void> {
    const doc = await this.prisma.prometeoDocument.findUnique({ where: { id: documentId }, select: { metadataJson: true } });
    const current = (doc?.metadataJson ?? {}) as Record<string, unknown>;
    await this.prisma.prometeoDocument.update({
      where: { id: documentId },
      data: { metadataJson: { ...current, ...extra } as unknown as import("@prisma/client").Prisma.InputJsonValue },
    });
  }

  async listDocuments(input: { tenantId: string; projectId?: string; limit?: number }): Promise<PrometeoDocumentRecord[]> {
    return this.prisma.prometeoDocument.findMany({
      where: { tenantId: input.tenantId, ...(input.projectId ? { projectId: input.projectId } : {}) },
      orderBy: { createdAt: "desc" }, take: input.limit ?? 50,
    }) as Promise<PrometeoDocumentRecord[]>;
  }

  async getDocument(id: string): Promise<PrometeoDocumentRecord | null> {
    return this.prisma.prometeoDocument.findUnique({ where: { id } }) as Promise<PrometeoDocumentRecord | null>;
  }

  async deleteDocument(input: { tenantId: string; id: string }): Promise<void> {
    const result = await this.prisma.prometeoDocument.deleteMany({
      where: {
        id: input.id,
        tenantId: input.tenantId,
      },
    });
    if (result.count !== 1) {
      throw new NotFoundException(`Prometeo document '${input.id}' not found`);
    }
  }

  async loadChunksForSearch(input: { tenantId: string; projectId?: string; limit?: number }): Promise<PrometeoChunkSearchRow[]> {
    const docs = await this.prisma.prometeoDocument.findMany({
      where: { tenantId: input.tenantId, status: "indexed", ...(input.projectId ? { projectId: input.projectId } : {}) },
      select: { id: true },
    });
    if (docs.length === 0) return [];
    return this.prisma.documentChunk.findMany({
      where: { tenantId: input.tenantId, documentId: { in: docs.map((d: { id: string }) => d.id) } },
      take: input.limit ?? 2000,
      select: { id: true, documentId: true, chunkIndex: true, text: true, embeddingJson: true, metadataJson: true },
    }) as Promise<PrometeoChunkSearchRow[]>;
  }

  async getDocumentTitles(docIds: string[]): Promise<Map<string, string>> {
    if (!docIds.length) return new Map();
    const docs = await this.prisma.prometeoDocument.findMany({ where: { id: { in: docIds } }, select: { id: true, title: true } });
    return new Map(docs.map((d: { id: string; title: string }) => [d.id, d.title]));
  }

  async updateChunkEmbedding(documentId: string, chunkIndex: number, embedding: number[]): Promise<void> {
    await this.prisma.documentChunk.updateMany({
      where: { documentId, chunkIndex },
      data: { embeddingJson: embedding as unknown as import("@prisma/client").Prisma.InputJsonValue },
    });
  }

  async createAsset(input: { tenantId: string; orgId: string; projectId?: string; name: string; category?: string; serialNumber?: string; location?: string; metadataJson?: Record<string, unknown> }) {
    return this.prisma.prometeoAsset.create({
      data: { tenantId: input.tenantId, orgId: input.orgId, projectId: input.projectId, name: input.name, category: input.category ?? "general", serialNumber: input.serialNumber, location: input.location, metadataJson: (input.metadataJson ?? {}) as unknown as import("@prisma/client").Prisma.InputJsonValue },
    });
  }

  async listAssets(input: { tenantId: string; projectId?: string; category?: string }) {
    return this.prisma.prometeoAsset.findMany({
      where: { tenantId: input.tenantId, ...(input.projectId ? { projectId: input.projectId } : {}), ...(input.category ? { category: input.category } : {}) },
      orderBy: { createdAt: "desc" }, take: 100,
    });
  }

  // ── Chunk Feedback ────────────────────────────────────────────────────────

  async saveFeedback(input: {
    tenantId: string; chunkId: string; documentId: string; userId: string;
    type: string; note?: string; query?: string; tradeTag?: string;
  }) {
    return this.prisma.prometeoChunkFeedback.create({
      data: {
        tenantId: input.tenantId, chunkId: input.chunkId, documentId: input.documentId,
        userId: input.userId, type: input.type,
        note: input.note, query: input.query, tradeTag: input.tradeTag,
      },
    });
  }

  /** Returns a Map<chunkId, feedbackScore> where score ∈ [-1, 1].
   *  confirm = +1.0, correct = +0.5, flag = -1.0 per entry. */
  async getFeedbackScores(tenantId: string, chunkIds: string[]): Promise<Map<string, number>> {
    if (!chunkIds.length) return new Map();
    const rows = await this.prisma.prometeoChunkFeedback.findMany({
      where: { tenantId, chunkId: { in: chunkIds } },
      select: { chunkId: true, type: true },
    });

    const WEIGHTS: Record<string, number> = { confirm: 1.0, correct: 0.5, flag: -1.0 };
    const acc = new Map<string, { sum: number; count: number }>();
    for (const r of rows) {
      const w = WEIGHTS[r.type] ?? 0;
      const cur = acc.get(r.chunkId) ?? { sum: 0, count: 0 };
      acc.set(r.chunkId, { sum: cur.sum + w, count: cur.count + 1 });
    }

    const result = new Map<string, number>();
    for (const [id, { sum, count }] of acc) {
      result.set(id, Math.max(-1, Math.min(1, sum / count)));
    }
    return result;
  }

  async getFeedbackStats(tenantId: string) {
    const rows = await this.prisma.prometeoChunkFeedback.findMany({
      where: { tenantId },
      select: { chunkId: true, documentId: true, type: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    const byType: Record<string, number> = {};
    const byDoc: Record<string, number> = {};
    for (const r of rows) {
      byType[r.type] = (byType[r.type] ?? 0) + 1;
      byDoc[r.documentId] = (byDoc[r.documentId] ?? 0) + 1;
    }

    const chunksWithFeedback = new Set(rows.map((r: { chunkId: string }) => r.chunkId)).size;
    return {
      totalFeedback: rows.length,
      chunksWithFeedback,
      byType,
      topDocuments: Object.entries(byDoc)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([documentId, count]) => ({ documentId, count })),
      lastFeedbackAt: rows[0]?.createdAt ?? null,
    };
  }

  async getChunkById(tenantId: string, chunkId: string) {
    return this.prisma.documentChunk.findFirst({
      where: { id: chunkId, tenantId },
      select: { id: true, documentId: true, chunkIndex: true, text: true },
    });
  }

  async updateAssetStatus(input: { tenantId: string; id: string; status: string }) {
    const result = await this.prisma.prometeoAsset.updateMany({
      where: {
        id: input.id,
        tenantId: input.tenantId,
      },
      data: { status: input.status, updatedAt: new Date() },
    });
    if (result.count !== 1) {
      throw new NotFoundException(`Prometeo asset '${input.id}' not found`);
    }
    return { id: input.id, status: input.status };
  }

  async createWorkOrder(input: { tenantId: string; orgId: string; projectId?: string; jobId?: string; title: string; description?: string; priority?: string; assignedToId?: string; scheduledAt?: Date; dueAt?: Date }) {
    return this.prisma.workOrder.create({
      data: { tenantId: input.tenantId, orgId: input.orgId, projectId: input.projectId, jobId: input.jobId, title: input.title, description: input.description, priority: input.priority ?? "medium", assignedToId: input.assignedToId, scheduledAt: input.scheduledAt, dueAt: input.dueAt },
    });
  }

  async listWorkOrders(input: { tenantId: string; projectId?: string; status?: string; assignedToId?: string; limit?: number }) {
    return this.prisma.workOrder.findMany({
      where: { tenantId: input.tenantId, ...(input.projectId ? { projectId: input.projectId } : {}), ...(input.status ? { status: input.status } : {}), ...(input.assignedToId ? { assignedToId: input.assignedToId } : {}) },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: input.limit ?? 50,
    });
  }

  async updateWorkOrderStatus(input: { tenantId: string; id: string; status: string }) {
    const result = await this.prisma.workOrder.updateMany({
      where: {
        id: input.id,
        tenantId: input.tenantId,
      },
      data: {
        status: input.status,
        ...(input.status === "closed" ? { closedAt: new Date() } : {}),
        updatedAt: new Date(),
      },
    });
    if (result.count !== 1) {
      throw new NotFoundException(`Prometeo work order '${input.id}' not found`);
    }
    return { id: input.id, status: input.status };
  }
}
