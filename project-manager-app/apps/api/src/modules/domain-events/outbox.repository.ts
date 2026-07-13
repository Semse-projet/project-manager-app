import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { SemseDomainEventV2 } from "@semse/schemas";

type OutboxTransactionClient = Pick<
  Prisma.TransactionClient,
  "domainOutboxEvent"
>;

@Injectable()
export class OutboxRepository {
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
}
