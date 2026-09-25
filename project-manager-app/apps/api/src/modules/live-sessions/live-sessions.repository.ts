import { Injectable } from "@nestjs/common";
import type {
  LiveSessionParticipantRole,
  LiveSessionPurpose,
  LiveSessionScopeType,
  LiveSessionStatus,
} from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export const LIVE_SESSIONS_REPOSITORY = Symbol("LIVE_SESSIONS_REPOSITORY");

export type LiveSessionRow = {
  id: string;
  tenantId: string;
  scopeType: LiveSessionScopeType;
  scopeId: string;
  purpose: LiveSessionPurpose;
  status: LiveSessionStatus;
  version: number;
  createdById: string;
  idempotencyKey: string;
  expiresAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LiveSessionParticipantRow = {
  id: string;
  tenantId: string;
  sessionId: string;
  userId: string;
  role: LiveSessionParticipantRole;
  invitedById: string;
  joinedAt: Date | null;
  leftAt: Date | null;
  createdAt: Date;
};

export type CreateLiveSessionInput = {
  tenantId: string;
  scopeType: LiveSessionScopeType;
  scopeId: string;
  purpose: LiveSessionPurpose;
  createdById: string;
  idempotencyKey: string;
  expiresAt: Date;
  ownerUserId: string;
};

export type AddParticipantInput = {
  tenantId: string;
  sessionId: string;
  userId: string;
  role: LiveSessionParticipantRole;
  invitedById: string;
};

/**
 * Puerto de persistencia de LiveSession. El servicio depende de esta interfaz
 * (no de Prisma) para que los tests inyecten un doble en memoria — así se
 * ejercita la FSM, la autorización por participante y la concurrencia
 * optimista sin una base de datos.
 */
export interface LiveSessionsRepository {
  findByIdempotency(tenantId: string, idempotencyKey: string): Promise<LiveSessionRow | null>;
  /** Crea la sesión y siembra al `ownerUserId` como participante `owner`, atómico. */
  create(input: CreateLiveSessionInput): Promise<LiveSessionRow>;
  findById(tenantId: string, sessionId: string): Promise<LiveSessionRow | null>;
  listParticipants(sessionId: string): Promise<LiveSessionParticipantRow[]>;
  findParticipant(sessionId: string, userId: string): Promise<LiveSessionParticipantRow | null>;
  addParticipant(input: AddParticipantInput): Promise<LiveSessionParticipantRow>;
  /**
   * Transición atómica con concurrencia optimista: sólo aplica si
   * `version === expectedVersion`; devuelve `null` si otra escritura ganó.
   */
  transition(input: {
    tenantId: string;
    sessionId: string;
    expectedVersion: number;
    toStatus: LiveSessionStatus;
    endedAt: Date | null;
  }): Promise<LiveSessionRow | null>;
  /** Sesiones no terminales vencidas (`expiresAt <= now`), para el barrido. */
  listExpired(now: Date, limit: number): Promise<LiveSessionRow[]>;
}

@Injectable()
export class PrismaLiveSessionsRepository implements LiveSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdempotency(tenantId: string, idempotencyKey: string): Promise<LiveSessionRow | null> {
    return this.prisma.liveSession.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    }) as unknown as Promise<LiveSessionRow | null>;
  }

  async create(input: CreateLiveSessionInput): Promise<LiveSessionRow> {
    const row = await this.prisma.$transaction(async (tx) => {
      const session = await tx.liveSession.create({
        data: {
          tenantId: input.tenantId,
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          purpose: input.purpose,
          createdById: input.createdById,
          idempotencyKey: input.idempotencyKey,
          expiresAt: input.expiresAt,
        },
      });
      await tx.liveSessionParticipant.create({
        data: {
          tenantId: input.tenantId,
          sessionId: session.id,
          userId: input.ownerUserId,
          role: "owner",
          invitedById: input.createdById,
        },
      });
      return session;
    });
    return row as unknown as LiveSessionRow;
  }

  async findById(tenantId: string, sessionId: string): Promise<LiveSessionRow | null> {
    return this.prisma.liveSession.findFirst({
      where: { id: sessionId, tenantId },
    }) as unknown as Promise<LiveSessionRow | null>;
  }

  async listParticipants(sessionId: string): Promise<LiveSessionParticipantRow[]> {
    return this.prisma.liveSessionParticipant.findMany({
      where: { sessionId },
    }) as unknown as Promise<LiveSessionParticipantRow[]>;
  }

  async findParticipant(sessionId: string, userId: string): Promise<LiveSessionParticipantRow | null> {
    return this.prisma.liveSessionParticipant.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    }) as unknown as Promise<LiveSessionParticipantRow | null>;
  }

  async addParticipant(input: AddParticipantInput): Promise<LiveSessionParticipantRow> {
    return this.prisma.liveSessionParticipant.create({
      data: {
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        userId: input.userId,
        role: input.role,
        invitedById: input.invitedById,
      },
    }) as unknown as Promise<LiveSessionParticipantRow>;
  }

  async transition(input: {
    tenantId: string;
    sessionId: string;
    expectedVersion: number;
    toStatus: LiveSessionStatus;
    endedAt: Date | null;
  }): Promise<LiveSessionRow | null> {
    const updated = await this.prisma.liveSession.updateMany({
      where: { id: input.sessionId, tenantId: input.tenantId, version: input.expectedVersion },
      data: {
        status: input.toStatus,
        version: { increment: 1 },
        ...(input.endedAt ? { endedAt: input.endedAt } : {}),
      },
    });
    if (updated.count === 0) return null;
    return this.findById(input.tenantId, input.sessionId);
  }

  async listExpired(now: Date, limit: number): Promise<LiveSessionRow[]> {
    return this.prisma.liveSession.findMany({
      where: {
        expiresAt: { not: null, lte: now },
        status: { notIn: ["ENDED", "CANCELLED", "FAILED"] },
      },
      orderBy: { expiresAt: "asc" },
      take: limit,
    }) as unknown as Promise<LiveSessionRow[]>;
  }
}
