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
};

export type OutboxMetricsSnapshot = {
  pendingTotal: number;
  oldestPendingAgeSeconds: number;
  deadLetterTotal: number;
};

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
            event."recordedAt"
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
