import { Injectable } from "@nestjs/common";
import { semseEventSchema, type SemseEvent } from "@semse/schemas";
import { DomainEventBus } from "./domain-event-bus.service.js";
import { assertDomainEventEmittable, listManualEmitTypes } from "./domain-events.policy.js";
import {
  DomainEventsRepository,
  type DomainEventAgentRunRow,
  type DomainEventAuditRow
} from "./domain-events.repository.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function resolveRequestId(value: unknown): string {
  const payload = asRecord(value);
  return typeof payload?.requestId === "string" ? payload.requestId : "n/a";
}

function resolveEventType(row: DomainEventAuditRow): string | undefined {
  const payload = asRecord(row.afterJson);
  return typeof payload?.type === "string" ? payload.type : undefined;
}

function resolveEventMeta(row: DomainEventAuditRow) {
  const payload = asRecord(row.afterJson);
  const meta = asRecord(payload?.meta);
  if (!meta) {
    return undefined;
  }

  return {
    tenantId: typeof meta.tenantId === "string" ? meta.tenantId : undefined,
    correlationId: typeof meta.correlationId === "string" ? meta.correlationId : undefined,
    actorId: typeof meta.actorId === "string" ? meta.actorId : undefined,
    actorType:
      meta.actorType === "user" || meta.actorType === "system" || meta.actorType === "agent"
        ? meta.actorType
        : undefined,
    occurredAt: typeof meta.occurredAt === "string" ? meta.occurredAt : undefined,
    version: typeof meta.version === "number" ? meta.version : undefined
  };
}

function resolveTriggers(row: DomainEventAuditRow): string[] {
  const payload = asRecord(row.afterJson);
  const triggers = payload?.triggers;
  return Array.isArray(triggers) ? triggers.filter((entry): entry is string => typeof entry === "string") : [];
}

function resolvePayload(row: DomainEventAuditRow): Record<string, unknown> | undefined {
  const payload = asRecord(row.afterJson);
  return asRecord(payload?.payload);
}

function resolveCorrelationId(row: DomainEventAuditRow): string {
  const type = resolveEventType(row);
  if (type && row.entityId.startsWith(`${type}:`)) {
    return row.entityId.slice(type.length + 1);
  }

  return row.entityId;
}

@Injectable()
export class DomainEventsService {
  constructor(
    private readonly repository: DomainEventsRepository,
    private readonly domainEventBus: DomainEventBus
  ) {}

  async list(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    type?: string;
    correlationId?: string;
    limit?: number;
  }) {
    const take = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const rows = await this.repository.listDomainEventAuditRows({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      limit: take
    });

    const items = rows
      .map((row) => ({
        auditId: row.id,
        type: resolveEventType(row) ?? "unknown",
        correlationId: resolveCorrelationId(row),
        actorUserId: row.actorUserId ?? undefined,
        requestId: resolveRequestId(row.afterJson),
        triggers: resolveTriggers(row),
        payload: resolvePayload(row),
        meta: resolveEventMeta(row),
        timestamp: row.occurredAt.toISOString()
      }))
      .filter((item) => {
        if (input.type && item.type !== input.type) {
          return false;
        }

        if (input.correlationId && item.correlationId !== input.correlationId) {
          return false;
        }

        return true;
      });

    return {
      total: items.length,
      filters: {
        type: input.type,
        correlationId: input.correlationId,
        limit: take
      },
      items
    };
  }

  async trace(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    correlationId: string;
  }) {
    const eventRows = await this.repository.listDomainEventAuditRowsByCorrelationId(input);
    const runs = await this.repository.listAgentRunsByCorrelationId(input);
    const timelineRows = await this.repository.listTimelineRows({
      ...input,
      runIds: runs.map((run) => run.id)
    });
    const outboxRows = await this.repository.listOutboxByCorrelationId(input);
    const consumptionRows = await this.repository.listConsumptionsByEventIds({
      ...input,
      eventIds: outboxRows.map((row) => row.eventId)
    });

    const primaryEvent = eventRows[0];

    return {
      correlationId: input.correlationId,
      event: primaryEvent
        ? {
            auditId: primaryEvent.id,
            type: resolveEventType(primaryEvent) ?? "unknown",
            correlationId: resolveCorrelationId(primaryEvent),
            actorUserId: primaryEvent.actorUserId ?? undefined,
            requestId: resolveRequestId(primaryEvent.afterJson),
            triggers: resolveTriggers(primaryEvent),
            payload: resolvePayload(primaryEvent),
            meta: resolveEventMeta(primaryEvent),
            timestamp: primaryEvent.occurredAt.toISOString()
          }
        : undefined,
      runs: runs.map((run: DomainEventAgentRunRow) => ({
        id: run.id,
        agentType: run.agentType,
        triggerType: run.triggerType.toLowerCase(),
        status: run.status.toLowerCase(),
        workerId: run.workerId ?? undefined,
        attempts: run.attempts,
        maxAttempts: run.maxAttempts,
        deadLettered: run.deadLettered,
        requiresHumanReview: run.requiresHumanReview,
        error: run.error ?? undefined,
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt.toISOString(),
        startedAt: run.startedAt?.toISOString(),
        endedAt: run.endedAt?.toISOString()
      })),
      timeline: timelineRows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        requestId: resolveRequestId(row.afterJson),
        timestamp: row.occurredAt.toISOString()
      })),
      outbox: outboxRows.map((row) => ({
        eventId: row.eventId,
        eventType: row.eventType,
        status: row.status,
        attempts: row.attempts,
        maxAttempts: row.maxAttempts,
        replayCount: row.replayCount,
        recordedAt: row.recordedAt.toISOString(),
        publishedAt: row.publishedAt?.toISOString() ?? null,
        lastError: row.lastError,
        receipts: consumptionRows
          .filter((consumption) => consumption.eventId === row.eventId)
          .map((consumption) => ({
            consumerName: consumption.consumerName,
            status: consumption.status,
            attempts: consumption.attempts,
            maxAttempts: consumption.maxAttempts,
            replayCount: consumption.replayCount,
            completedAt: consumption.completedAt?.toISOString() ?? null,
            lastError: consumption.lastError
          }))
      }))
    };
  }

  async emit(
    event: SemseEvent,
    context: {
      tenantId: string;
      orgId: string;
      userId: string;
      requestId: string;
      roles: string[];
    }
  ) {
    const parsed = semseEventSchema.parse(event);
    assertDomainEventEmittable({
      event: parsed,
      tenantId: context.tenantId,
      roles: context.roles
    });
    return this.domainEventBus.emit(parsed, context);
  }

  manualEmitCatalog() {
    return {
      allowedTypes: listManualEmitTypes()
    };
  }
}
