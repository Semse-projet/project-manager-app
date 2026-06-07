import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

@Injectable()
export class IntelligenceRunsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    tenantId: string;
    agentName: string;
    triggerEvent: string;
    entityType: string;
    entityId: string;
    contextSnapshotJson?: Record<string, unknown>;
    decisionJson?: Record<string, unknown>;
    signalsCreated?: string[];
    status?: "completed" | "failed";
    error?: string;
    durationMs?: number;
  }) {
    return this.prisma.intelligenceRun.create({
      data: {
        tenantId: input.tenantId,
        agentName: input.agentName,
        triggerEvent: input.triggerEvent,
        entityType: input.entityType,
        entityId: input.entityId,
        contextSnapshotJson: (input.contextSnapshotJson ?? {}) as object,
        decisionJson: (input.decisionJson ?? {}) as object,
        signalsCreated: input.signalsCreated ?? [],
        status: input.status ?? "completed",
        error: input.error,
        durationMs: input.durationMs,
      },
    });
  }

  async listRecent(tenantId: string, limit = 20) {
    return this.prisma.intelligenceRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
