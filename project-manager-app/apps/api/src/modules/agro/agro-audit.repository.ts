import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

@Injectable()
export class AgroAuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    farmId: string;
    actorId?: string;
    entityType: string;
    entityId: string;
    action: string;
    before?: unknown;
    after?: unknown;
    source?: string;
  }) {
    return this.prisma.agroAuditEvent.create({
      data: {
        farmId: input.farmId,
        actorId: input.actorId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        before: input.before as any ?? undefined,
        after: input.after as any ?? undefined,
        source: input.source ?? "SYSTEM",
      },
    });
  }

  async list(input: { farmId: string; limit?: number }) {
    return this.prisma.agroAuditEvent.findMany({
      where: { farmId: input.farmId },
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 50,
    });
  }
}
