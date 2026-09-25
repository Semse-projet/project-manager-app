import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

/**
 * Phase 1 — Reliability substrate: Capability Reality Registry.
 *
 * General-purpose reality-tracking for product/engineering capabilities
 * ("is X actually done, and is it healthy right now"). Not the Phase 2
 * Agent Capability Protocol (risk ceilings, tool bindings, offline modes) —
 * that is a separate, richer contract for agents/tools specifically.
 *
 * Read-only from HTTP for now: there is no UI or agent consuming this yet,
 * so writes happen via migration seed data / internal calls only.
 */
@Injectable()
export class CapabilityRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.capability.findMany({
      include: { evidence: { orderBy: { recordedAt: "desc" } } },
      orderBy: { key: "asc" }
    });
  }

  async getByKey(key: string) {
    const capability = await this.prisma.capability.findUnique({
      where: { key },
      include: { evidence: { orderBy: { recordedAt: "desc" } } }
    });
    if (!capability) {
      throw new NotFoundException(`Capability not found: ${key}`);
    }
    return capability;
  }

  async listGoldenRegressions() {
    return this.prisma.goldenRegression.findMany({ orderBy: { key: "asc" } });
  }
}
