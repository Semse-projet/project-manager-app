import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

@Injectable()
export class AgroEvidenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listEvidence(farmId: string, filters?: { entityType?: string; entityId?: string }) {
    return this.prisma.agroEvidenceItem.findMany({
      where: {
        farmId,
        ...(filters?.entityType && { entityType: filters.entityType }),
        ...(filters?.entityId && { entityId: filters.entityId }),
      },
      orderBy: { capturedAt: "desc" },
    });
  }

  async findEvidence(evidenceId: string) {
    return this.prisma.agroEvidenceItem.findUnique({ where: { id: evidenceId } });
  }

  async createEvidence(input: {
    farmId: string;
    entityType: string;
    entityId?: string;
    mediaType: string;
    title?: string;
    note?: string;
    fileUrl?: string;
    capturedAt: Date;
    capturedById?: string;
    latitude?: number;
    longitude?: number;
  }) {
    return this.prisma.agroEvidenceItem.create({ data: input });
  }

  async updateEvidence(evidenceId: string, input: {
    title?: string;
    note?: string;
    fileUrl?: string;
  }) {
    return this.prisma.agroEvidenceItem.update({
      where: { id: evidenceId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.note !== undefined && { note: input.note }),
        ...(input.fileUrl !== undefined && { fileUrl: input.fileUrl }),
      },
    });
  }

  async recentEvidence(farmId: string, limit = 10) {
    return this.prisma.agroEvidenceItem.findMany({
      where: { farmId },
      orderBy: { capturedAt: "desc" },
      take: limit,
    });
  }
}
