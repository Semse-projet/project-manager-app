import { Injectable, Optional } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import prismaClientPackage from "../../../../../node_modules/.prisma/client/index.js";
import type { SemseDomainEventV2 } from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

const { Prisma: PrismaRuntime } = prismaClientPackage as typeof import("../../../../../node_modules/.prisma/client/index.js");

type OutboxTransactionClient = Pick<
  Prisma.TransactionClient,
  "domainOutboxEvent"
>;

export type ClaimedOutboxEvent = {
  eventId: string;
  eventType: string;
  attempts: number;
  maxAttempts: number;
  recordedAt: Date;
  replayCount: number;
};

export type OutboxMetricsSnapshot = {
  pendingTotal: number;
  oldestPendingAgeSeconds: number;
  deadLetterTotal: number;
};

export type OutboxStatusName =
  | "PENDING"
  | "CLAIMED"
  | "PUBLISHED"
  | "FAILED"
  | "DEAD_LETTER";

export type OutboxListItem = {
  eventId: string;
  eventType: string;
  status: OutboxStatusName;
  correlationId: string;
  causationId: string | null;
  entityType: string;
  entityId: string;
  attempts: number;
  maxAttempts: number;
  replayCount: number;
  recordedAt: Date;
  publishedAt: Date | null;
  nextAttemptAt: Date;
  lastError: string | null;
};

export type OutboxDeliveryDetail = OutboxListItem & {
  module: string;
  orgId: string;
  actorType: string;
  actorId: string;
  occurredAt: Date;
  consumptions: Array<{
    consumerName: string;
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "DEAD_LETTER";
    attempts: number;
    maxAttempts: number;
    replayCount: number;
    startedAt: Date | null;
    completedAt: Date | null;
    nextAttemptAt: Date;
    lastError: string | null;
  }>;
};

const OUTBOX_LIST_SELECT = {
  eventId: true,
  eventType: true,
  status: true,
  correlationId: true,
  causationId: true,
  entityType: true,
  entityId: true,
  attempts: true,
  maxAttempts: true,
  replayCount: true,
  recordedAt: true,
  publishedAt: true,
  nextAttemptAt: true,
  lastError: true,
} as const;

export type OutboxReplayResult =
  | { outcome: "not_found" }
  | { outcome: "conflict"; status: string }
  | { outcome: "replayed"; replayCount: number; status: "PENDING" };

function boundedInteger(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${label} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return value;
}

@Injectable()
export class OutboxRepository {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async create(
    tx: OutboxTransactionClient,
    event: SemseDomainEventV2,
  ): Promise<void> {
    await tx.domainOutboxEvent.create({
      data: {
        eventId: event.eventId,
        eventType: event.eventType,
        version: event.version,
        envelopeVersion: event.envelopeVersion,
        tenantId: event.tenantId,
        orgId: event.orgId,
        module: event.module,
        entityType: event.entityType,
        entityId: event.entityId,
        actorType: event.actor.type,
        actorId: event.actor.id,
        correlationId: event.correlationId,
        causationId: event.causationId,
        idempotencyKey: event.idempotencyKey,
        schemaRef: event.schemaRef,
        payloadJson: event.payload as Prisma.InputJsonValue,
        metadataJson: event.metadata as Prisma.InputJsonValue | undefined,
        traceContextJson: event.traceContext as
          Prisma.InputJsonValue | undefined,
        occurredAt: new Date(event.occurredAt),
        recordedAt: new Date(event.recordedAt),
      },
    });
  }

  async claimBatch(input: {
    dispatcherId: string;
    batchSize: number;
    leaseMs: number;
    now?: Date;
  }): Promise<ClaimedOutboxEvent[]> {
    const prisma = this.requirePrisma();
    const batchSize = boundedInteger(input.batchSize, 1, 250, "batchSize");
    const leaseMs = boundedInteger(input.leaseMs, 1_000, 300_000, "leaseMs");
    const dispatcherId = input.dispatcherId.trim();
    if (!dispatcherId) {
      throw new Error("dispatcherId is required");
    }
    const now = input.now ?? new Date();
    const lockExpiresAt = new Date(now.getTime() + leaseMs);

    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        PrismaRuntime.sql`
          UPDATE "DomainOutboxEvent"
          SET
            "status" = 'DEAD_LETTER'::"DomainOutboxStatus",
            "lockedAt" = NULL,
            "lockExpiresAt" = NULL,
            "lockedBy" = NULL,
            "lastError" = COALESCE("lastError", 'Dispatcher lease expired after max attempts')
          WHERE "status" = 'CLAIMED'::"DomainOutboxStatus"
            AND "lockExpiresAt" <= ${now}
            AND "attempts" >= "maxAttempts"
        `,
      );

      return tx.$queryRaw<ClaimedOutboxEvent[]>(
        PrismaRuntime.sql`
          WITH candidates AS (
            SELECT "eventId"
            FROM "DomainOutboxEvent"
            WHERE (
              (
                "status" IN (
                  'PENDING'::"DomainOutboxStatus",
                  'FAILED'::"DomainOutboxStatus"
                )
                AND "nextAttemptAt" <= ${now}
              ) OR (
                "status" = 'CLAIMED'::"DomainOutboxStatus"
                AND "lockExpiresAt" <= ${now}
              )
            )
              AND "attempts" < "maxAttempts"
            ORDER BY "recordedAt", "eventId"
            FOR UPDATE SKIP LOCKED
            LIMIT ${batchSize}
          )
          UPDATE "DomainOutboxEvent" AS event
          SET
            "status" = 'CLAIMED'::"DomainOutboxStatus",
            "attempts" = event."attempts" + 1,
            "lockedAt" = ${now},
            "lockExpiresAt" = ${lockExpiresAt},
            "lockedBy" = ${dispatcherId}
          FROM candidates
          WHERE event."eventId" = candidates."eventId"
          RETURNING
            event."eventId",
            event."eventType",
            event."attempts",
            event."maxAttempts",
            event."recordedAt",
            event."replayCount"
        `,
      );
    });
  }

  async markPublished(input: {
    eventId: string;
    dispatcherId: string;
    publishedAt?: Date;
  }): Promise<boolean> {
    const result = await this.requirePrisma().domainOutboxEvent.updateMany({
      where: {
        eventId: input.eventId,
        status: "CLAIMED",
        lockedBy: input.dispatcherId,
      },
      data: {
        status: "PUBLISHED",
        publishedAt: input.publishedAt ?? new Date(),
        lockedAt: null,
        lockExpiresAt: null,
        lockedBy: null,
        lastError: null,
      },
    });

    return result.count === 1;
  }

  async markFailed(input: {
    eventId: string;
    dispatcherId: string;
    attempts: number;
    maxAttempts: number;
    error: string;
    now?: Date;
  }): Promise<{ status: "FAILED" | "DEAD_LETTER"; attempts: number } | null> {
    const now = input.now ?? new Date();
    const status =
      input.attempts >= input.maxAttempts ? "DEAD_LETTER" : "FAILED";
    const backoffMs = Math.min(
      5 * 60_000,
      1_000 * 2 ** Math.max(0, input.attempts - 1),
    );
    const result = await this.requirePrisma().domainOutboxEvent.updateMany({
      where: {
        eventId: input.eventId,
        status: "CLAIMED",
        lockedBy: input.dispatcherId,
        attempts: input.attempts,
      },
      data: {
        status,
        nextAttemptAt: new Date(now.getTime() + backoffMs),
        lockedAt: null,
        lockExpiresAt: null,
        lockedBy: null,
        lastError: input.error.slice(0, 500),
      },
    });

    return result.count === 1 ? { status, attempts: input.attempts } : null;
  }

  async list(input: {
    tenantId: string;
    status?: OutboxStatusName;
    eventType?: string;
    correlationId?: string;
    limit: number;
    cursor?: { recordedAt: Date; eventId: string };
  }): Promise<{ items: OutboxListItem[]; nextCursor: string | null }> {
    const prisma = this.requirePrisma();
    const rows = await prisma.domainOutboxEvent.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.eventType ? { eventType: input.eventType } : {}),
        ...(input.correlationId ? { correlationId: input.correlationId } : {}),
        ...(input.cursor
          ? {
              OR: [
                { recordedAt: { gt: input.cursor.recordedAt } },
                {
                  recordedAt: input.cursor.recordedAt,
                  eventId: { gt: input.cursor.eventId },
                },
              ],
            }
          : {}),
      },
      select: OUTBOX_LIST_SELECT,
      orderBy: [{ recordedAt: "asc" }, { eventId: "asc" }],
      take: input.limit + 1,
    });

    const page = rows.slice(0, input.limit);
    const hasMore = rows.length > input.limit;
    const last = page[page.length - 1];

    return {
      items: page as OutboxListItem[],
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({
                recordedAt: last.recordedAt.toISOString(),
                eventId: last.eventId,
              }),
            ).toString("base64url")
          : null,
    };
  }

  async countsByStatus(
    tenantId: string,
  ): Promise<Record<OutboxStatusName, number>> {
    const prisma = this.requirePrisma();
    const grouped = await prisma.domainOutboxEvent.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
    });
    const counts: Record<OutboxStatusName, number> = {
      PENDING: 0,
      CLAIMED: 0,
      PUBLISHED: 0,
      FAILED: 0,
      DEAD_LETTER: 0,
    };
    for (const row of grouped) {
      counts[row.status as OutboxStatusName] = row._count._all;
    }
    return counts;
  }

  async oldestPendingAgeMs(tenantId: string, now = new Date()): Promise<number> {
    const prisma = this.requirePrisma();
    const oldest = await prisma.domainOutboxEvent.findFirst({
      where: { tenantId, status: { in: ["PENDING", "FAILED", "CLAIMED"] } },
      orderBy: [{ recordedAt: "asc" }, { eventId: "asc" }],
      select: { recordedAt: true },
    });
    return oldest ? Math.max(0, now.getTime() - oldest.recordedAt.getTime()) : 0;
  }

  async findDeliveryDetail(input: {
    eventId: string;
    tenantId: string;
  }): Promise<OutboxDeliveryDetail | null> {
    const prisma = this.requirePrisma();
    const event = await prisma.domainOutboxEvent.findFirst({
      where: { eventId: input.eventId, tenantId: input.tenantId },
      select: {
        ...OUTBOX_LIST_SELECT,
        module: true,
        orgId: true,
        actorType: true,
        actorId: true,
        occurredAt: true,
      },
    });
    if (!event) {
      return null;
    }

    const consumptions = await prisma.domainEventConsumption.findMany({
      where: { eventId: input.eventId, tenantId: input.tenantId },
      select: {
        consumerName: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        replayCount: true,
        startedAt: true,
        completedAt: true,
        nextAttemptAt: true,
        lastError: true,
      },
      orderBy: { consumerName: "asc" },
    });

    return {
      ...(event as unknown as OutboxListItem),
      module: event.module,
      orgId: event.orgId,
      actorType: event.actorType,
      actorId: event.actorId,
      occurredAt: event.occurredAt,
      consumptions,
    };
  }

  async replay(input: {
    eventId: string;
    tenantId: string;
    consumerName?: string;
    now?: Date;
  }): Promise<OutboxReplayResult> {
    const prisma = this.requirePrisma();
    const now = input.now ?? new Date();

    return prisma.$transaction(async (tx) => {
      const event = await tx.domainOutboxEvent.findFirst({
        where: { eventId: input.eventId, tenantId: input.tenantId },
        select: { eventId: true, status: true, replayCount: true },
      });
      if (!event) {
        return { outcome: "not_found" };
      }

      if (input.consumerName) {
        const consumption = await tx.domainEventConsumption.findFirst({
          where: {
            eventId: input.eventId,
            tenantId: input.tenantId,
            consumerName: input.consumerName,
          },
          select: { id: true, status: true },
        });
        if (!consumption) {
          return { outcome: "not_found" };
        }
        if (consumption.status !== "DEAD_LETTER") {
          return { outcome: "conflict", status: consumption.status };
        }

        const replayCount = event.replayCount + 1;
        await tx.domainEventConsumption.update({
          where: { id: consumption.id },
          data: {
            status: "PENDING",
            attempts: 0,
            startedAt: null,
            completedAt: null,
            nextAttemptAt: now,
          },
        });
        await tx.domainOutboxEvent.update({
          where: { eventId: input.eventId },
          data: { replayCount },
        });
        return { outcome: "replayed", replayCount, status: "PENDING" };
      }

      if (event.status !== "DEAD_LETTER") {
        return { outcome: "conflict", status: event.status };
      }

      const replayCount = event.replayCount + 1;
      await tx.domainOutboxEvent.update({
        where: { eventId: input.eventId },
        data: {
          status: "PENDING",
          attempts: 0,
          nextAttemptAt: now,
          lockedAt: null,
          lockExpiresAt: null,
          lockedBy: null,
          replayCount,
        },
      });
      return { outcome: "replayed", replayCount, status: "PENDING" };
    });
  }

  async getMetricsSnapshot(now = new Date()): Promise<OutboxMetricsSnapshot> {
    const prisma = this.requirePrisma();
    const unresolvedStatuses = ["PENDING", "FAILED", "CLAIMED"] as const;
    const [pendingTotal, oldestPending, deadLetterTotal] = await Promise.all([
      prisma.domainOutboxEvent.count({
        where: { status: { in: [...unresolvedStatuses] } },
      }),
      prisma.domainOutboxEvent.findFirst({
        where: { status: { in: [...unresolvedStatuses] } },
        orderBy: [{ recordedAt: "asc" }, { eventId: "asc" }],
        select: { recordedAt: true },
      }),
      prisma.domainOutboxEvent.count({ where: { status: "DEAD_LETTER" } }),
    ]);

    return {
      pendingTotal,
      oldestPendingAgeSeconds: oldestPending
        ? Math.max(0, (now.getTime() - oldestPending.recordedAt.getTime()) / 1_000)
        : 0,
      deadLetterTotal,
    };
  }

  private requirePrisma(): PrismaService {
    if (!this.prisma) {
      throw new Error("PrismaService is required for outbox delivery operations");
    }
    return this.prisma;
  }
}
