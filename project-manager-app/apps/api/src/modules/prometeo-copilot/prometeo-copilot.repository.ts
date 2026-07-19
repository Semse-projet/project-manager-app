import { Injectable, Logger } from "@nestjs/common";
import type { CopilotMissionSuggestion } from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export type CopilotSession = {
  sessionId: string;
  tenantId: string;
  userId: string;
  module: string;
  lastMissionSuggestion?: CopilotMissionSuggestion;
};

export interface CopilotSessionRepository {
  find(sessionId: string): Promise<CopilotSession | null>;
  save(session: CopilotSession): Promise<void>;
}

export const COPILOT_SESSION_REPOSITORY = Symbol("COPILOT_SESSION_REPOSITORY");

/** In-memory repository — used by unit tests and as a degradation fallback. */
export class InMemoryCopilotSessionRepository implements CopilotSessionRepository {
  private readonly sessions = new Map<string, CopilotSession>();

  async find(sessionId: string): Promise<CopilotSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async save(session: CopilotSession): Promise<void> {
    this.sessions.set(session.sessionId, { ...session });
  }
}

@Injectable()
export class PrismaCopilotSessionRepository implements CopilotSessionRepository {
  private readonly logger = new Logger(PrismaCopilotSessionRepository.name);
  private readonly fallback = new InMemoryCopilotSessionRepository();
  private degraded = false;

  constructor(private readonly prisma: PrismaService) {}

  async find(sessionId: string): Promise<CopilotSession | null> {
    try {
      const row = await this.prisma.prometeoCopilotSession.findUnique({ where: { id: sessionId } });
      if (!row) {
        return null;
      }
      return {
        sessionId: row.id,
        tenantId: row.tenantId,
        userId: row.userId,
        module: row.module,
        lastMissionSuggestion:
          (row.lastMissionSuggestion as CopilotMissionSuggestion | null) ?? undefined,
      };
    } catch (error) {
      this.degrade(error);
      return this.fallback.find(sessionId);
    }
  }

  async save(session: CopilotSession): Promise<void> {
    // Only write lastMissionSuggestion when present; omitting it on update
    // preserves any previously stored suggestion (Prisma leaves it unchanged).
    const suggestion =
      session.lastMissionSuggestion === undefined
        ? {}
        : {
            lastMissionSuggestion:
              session.lastMissionSuggestion as unknown as import("@prisma/client").Prisma.InputJsonValue,
          };
    try {
      await this.prisma.prometeoCopilotSession.upsert({
        where: { id: session.sessionId },
        create: {
          id: session.sessionId,
          tenantId: session.tenantId,
          userId: session.userId,
          module: session.module,
          ...suggestion,
        },
        update: { module: session.module, ...suggestion },
      });
    } catch (error) {
      this.degrade(error);
      await this.fallback.save(session);
    }
  }

  private degrade(error: unknown): void {
    if (!this.degraded) {
      this.degraded = true;
      this.logger.warn(
        `Prometeo copilot session persistence degraded to in-memory: ${(error as Error)?.message ?? String(error)}`,
      );
    }
  }
}
