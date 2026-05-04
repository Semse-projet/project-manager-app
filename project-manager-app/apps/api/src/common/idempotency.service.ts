import { Injectable } from "@nestjs/common";
import { PrismaService } from "../infrastructure/prisma/prisma.service.js";

const TTL_MS = 24 * 60 * 60 * 1000; // 24h

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async get<T>(tenantId: string, key: string): Promise<T | undefined> {
    const row = await this.prisma.agentRunIdempotency.findUnique({
      where: { tenantId_key: { tenantId, key } }
    });

    if (!row) return undefined;
    if (row.expiresAt < new Date()) {
      await this.prisma.agentRunIdempotency.delete({ where: { tenantId_key: { tenantId, key } } }).catch(() => {});
      return undefined;
    }

    return row.runId as unknown as T;
  }

  async set(tenantId: string, key: string, runId: string): Promise<void> {
    const expiresAt = new Date(Date.now() + TTL_MS);
    await this.prisma.agentRunIdempotency.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, runId, expiresAt },
      update: { runId, expiresAt }
    });
  }
}
