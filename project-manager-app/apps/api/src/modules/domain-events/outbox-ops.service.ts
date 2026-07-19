import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { DomainEventQueueService } from "../../infrastructure/queue/domain-event-queue.service.js";
import {
  OutboxRepository,
  type OutboxDeliveryDetail,
  type OutboxListItem,
  type OutboxStatusName,
} from "./outbox.repository.js";

export const OPS_EVENT_REPLAY_REQUESTED_TYPE = "ops.event_replay_requested.v1";

const VALID_STATUSES = new Set<OutboxStatusName>([
  "PENDING",
  "CLAIMED",
  "PUBLISHED",
  "FAILED",
  "DEAD_LETTER",
]);

type ActorInput = {
  tenantId: string;
  orgId: string;
  userId: string;
  requestId: string;
};

function decodeCursor(cursor: string | undefined): { recordedAt: Date; eventId: string } | undefined {
  if (!cursor) {
    return undefined;
  }
  let decoded: { recordedAt: string; eventId: string };
  try {
    decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new BadRequestException({ message: "Invalid cursor" });
  }
  const recordedAt = new Date(decoded.recordedAt);
  if (!decoded.eventId || Number.isNaN(recordedAt.getTime())) {
    throw new BadRequestException({ message: "Invalid cursor" });
  }
  return { recordedAt, eventId: decoded.eventId };
}

function serializeItem(item: OutboxListItem) {
  return {
    eventId: item.eventId,
    eventType: item.eventType,
    status: item.status,
    correlationId: item.correlationId,
    causationId: item.causationId,
    entityType: item.entityType,
    entityId: item.entityId,
    attempts: item.attempts,
    maxAttempts: item.maxAttempts,
    replayCount: item.replayCount,
    recordedAt: item.recordedAt.toISOString(),
    publishedAt: item.publishedAt?.toISOString() ?? null,
    nextAttemptAt: item.nextAttemptAt.toISOString(),
    lastError: item.lastError,
  };
}

function serializeDetail(detail: OutboxDeliveryDetail) {
  return {
    ...serializeItem(detail),
    module: detail.module,
    orgId: detail.orgId,
    actorType: detail.actorType,
    actorId: detail.actorId,
    occurredAt: detail.occurredAt.toISOString(),
    consumptions: detail.consumptions.map((consumption) => ({
      consumerName: consumption.consumerName,
      status: consumption.status,
      attempts: consumption.attempts,
      maxAttempts: consumption.maxAttempts,
      replayCount: consumption.replayCount,
      startedAt: consumption.startedAt?.toISOString() ?? null,
      completedAt: consumption.completedAt?.toISOString() ?? null,
      nextAttemptAt: consumption.nextAttemptAt.toISOString(),
      lastError: consumption.lastError,
    })),
  };
}

@Injectable()
export class OutboxOpsService {
  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly auditService: AuditService,
    private readonly queueService: DomainEventQueueService,
  ) {}

  async listOutbox(input: {
    actor: ActorInput;
    status?: string;
    eventType?: string;
    correlationId?: string;
    limit?: number;
    cursor?: string;
  }) {
    if (input.status && !VALID_STATUSES.has(input.status as OutboxStatusName)) {
      throw new BadRequestException({ message: "Invalid status filter", status: input.status });
    }
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const cursor = decodeCursor(input.cursor);

    const [{ items, nextCursor }, counts, oldestPendingAgeMs] = await Promise.all([
      this.outboxRepository.list({
        tenantId: input.actor.tenantId,
        status: input.status as OutboxStatusName | undefined,
        eventType: input.eventType,
        correlationId: input.correlationId,
        limit,
        cursor,
      }),
      this.outboxRepository.countsByStatus(input.actor.tenantId),
      this.outboxRepository.oldestPendingAgeMs(input.actor.tenantId),
    ]);

    return {
      items: items.map(serializeItem),
      nextCursor,
      counts,
      oldestPendingAgeMs,
    };
  }

  async getDeliveryDetail(input: { actor: ActorInput; eventId: string }) {
    const detail = await this.outboxRepository.findDeliveryDetail({
      eventId: input.eventId,
      tenantId: input.actor.tenantId,
    });
    if (!detail) {
      throw new NotFoundException({ message: "Domain event not found", eventId: input.eventId });
    }
    return serializeDetail(detail);
  }

  async replay(input: {
    actor: ActorInput;
    eventId: string;
    consumerName?: string;
    reason: string;
  }) {
    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException({ message: "reason is required" });
    }

    const result = await this.outboxRepository.replay({
      eventId: input.eventId,
      tenantId: input.actor.tenantId,
      consumerName: input.consumerName,
    });

    if (result.outcome === "not_found") {
      throw new NotFoundException({ message: "Domain event not found", eventId: input.eventId });
    }
    if (result.outcome === "conflict") {
      throw new ConflictException({
        message: "Domain event or consumer is not in a replayable terminal state",
        eventId: input.eventId,
        consumerName: input.consumerName,
        status: result.status,
      });
    }

    const auditRef = `aud_${randomUUID()}`;
    await this.auditService.append({
      id: auditRef,
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      actorUserId: input.actor.userId,
      action: "domain.event.emit",
      entityType: "DomainEvent",
      entityId: `${OPS_EVENT_REPLAY_REQUESTED_TYPE}:${input.eventId}`,
      requestId: input.actor.requestId,
      timestamp: new Date().toISOString(),
      afterJson: {
        type: OPS_EVENT_REPLAY_REQUESTED_TYPE,
        eventId: input.eventId,
        consumerName: input.consumerName ?? null,
        reason,
        replayCount: result.replayCount,
        status: result.status,
      },
    });

    // Re-enqueue so the worker re-processes this delivery; the outbox
    // dispatcher's own polling loop already covers the no-consumerName case
    // via the DEAD_LETTER -> PENDING transition, but a consumer-level replay
    // needs an explicit push since the outbox row itself may still be PUBLISHED.
    if (input.consumerName) {
      await this.queueService.enqueueEvent({
        eventId: input.eventId,
        generation: result.replayCount,
      });
    }

    return {
      eventId: input.eventId,
      replayCount: result.replayCount,
      status: result.status,
      auditRef,
    };
  }
}
