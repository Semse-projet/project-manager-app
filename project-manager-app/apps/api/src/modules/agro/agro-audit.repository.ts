import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

/** Cliente mínimo para escribir auditoría dentro de una transacción ajena. */
export type AgroAuditWriter = { agroAuditEvent: { create(args: any): Promise<unknown> } };

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
  }, client: AgroAuditWriter = this.prisma) {
    return client.agroAuditEvent.create({
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

  /** Timeline de una entidad (incidencia, capacidad…) — misma fuente que la auditoría de finca. */
  async listForEntity(input: { farmId?: string; entityType: string; entityId: string; limit?: number }) {
    return this.prisma.agroAuditEvent.findMany({
      where: {
        ...(input.farmId && { farmId: input.farmId }),
        entityType: input.entityType,
        entityId: input.entityId,
      },
      orderBy: { createdAt: "asc" },
      take: input.limit ?? 200,
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
