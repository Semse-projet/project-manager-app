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
