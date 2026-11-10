import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { DomainOutboxEvent, Prisma } from "@prisma/client";
import prismaClientPackage from "../../../../../node_modules/.prisma/client/index.js";
import { semseEventSchema } from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { mapEventToNotifications, NotificationsService } from "../notifications/notifications.service.js";
import {
  buildLegacyDisputeEvent,
  DISPUTE_EFFECTS_CONSUMER,
  disputeV2Schema,
  isDisputeV2EventType,
  type DisputeEffectsMode,
  type LegacyDisputeEvent,
} from "../disputes/dispute-events-v2.js";
import { AgentTriggerRouter } from "./agent-trigger-router.service.js";

const { Prisma: PrismaRuntime } = prismaClientPackage as typeof import("../../../../../node_modules/.prisma/client/index.js");

export { DISPUTE_EFFECTS_CONSUMER } from "../disputes/dispute-events-v2.js";

const MAX_ATTEMPTS = 5;

/** The event can never succeed (unknown type, invalid envelope, dispute missing for its tenant): dead-letter now. */
export class DisputeEffectsTerminalError extends Error {}
/** The receipt is already in DEAD_LETTER; only an operator replay may move it. */
export class DisputeEffectsDeadLetteredError extends Error {}

export type DisputeEffectsResult = {
  eventId: string;
  consumer: typeof DISPUTE_EFFECTS_CONSUMER;
  status: "completed";
  /** `updated` = notifications/triggers were executed (`on`); `no_op` = shadow, nothing executed. */
  effect: "updated" | "no_op";
  effectsMode: DisputeEffectsMode;
  legacyEventType: string;
  /** What the legacy bus produces (shadow) or what this consumer produced (`on`) — the shadow-parity record. */
  notifications: Array<{ userId: string; type: string }>;
  triggers: string[];
  duplicate?: boolean;
};

type Receipt = { id: string; status: string; attempts: number; resultJson: unknown };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * Event backbone F2, slice 1 (spec platform.event-backbone-f2-legacy-producers, D1/D3).
 *
 * Rebuilds the legacy dispute event from the v2 outbox event plus the dispute re-read for its tenant, then:
 *  - `metadata.effectsMode === "on"`: runs the agent triggers first (AgentTriggerRouter is idempotent per
 *    type + correlation + agent) and the notifications second, because only the notifications can duplicate on a
 *    retry (at-least-once, as with satellite webhooks);
 *  - otherwise (`shadow`, or anything unrecognised): executes nothing — the legacy bus still owns the effects — and
 *    records in the receipt what it would have produced, for comparison with the legacy path.
 *
 * The mode is the one stamped by the producer, not the current flag, so flipping the flag never drops or doubles
 * effects for events already in the outbox.
 */
@Injectable()
export class DisputeEffectsConsumer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly agentTriggerRouter: AgentTriggerRouter,
  ) {}

  async consume(stored: DomainOutboxEvent): Promise<DisputeEffectsResult> {
    if (!isDisputeV2EventType(stored.eventType)) {
      throw new DisputeEffectsTerminalError(`Unsupported dispute event type: ${stored.eventType}`);
    }
    const parsed = disputeV2Schema(stored.eventType).safeParse({
      eventId: stored.eventId,
      eventType: stored.eventType,
      version: stored.version,
      envelopeVersion: stored.envelopeVersion,
      occurredAt: stored.occurredAt.toISOString(),
      recordedAt: stored.recordedAt.toISOString(),
      tenantId: stored.tenantId,
      orgId: stored.orgId,
      module: stored.module,
      entityType: stored.entityType,
      entityId: stored.entityId,
      actor: { type: stored.actorType, id: stored.actorId },
      correlationId: stored.correlationId,
      ...(stored.causationId ? { causationId: stored.causationId } : {}),
      idempotencyKey: stored.idempotencyKey,
      schemaRef: stored.schemaRef,
      payload: stored.payloadJson,
      ...(stored.metadataJson ? { metadata: stored.metadataJson } : {}),
      ...(stored.traceContextJson ? { traceContext: stored.traceContextJson } : {}),
    });
    if (!parsed.success) {
      throw new DisputeEffectsTerminalError(
        `Invalid dispute event: ${parsed.error.issues[0]?.message ?? "schema validation failed"}`,
      );
    }
    const event = parsed.data;
    const metadata = record(event.metadata);
    const effectsMode: DisputeEffectsMode = metadata.effectsMode === "on" ? "on" : "shadow";

    const existing = await this.prisma.domainEventConsumption.findUnique({
      where: { eventId_consumerName: { eventId: event.eventId, consumerName: DISPUTE_EFFECTS_CONSUMER } },
      select: { status: true, resultJson: true },
    });
    if (existing?.status === "COMPLETED") {
      return { ...(existing.resultJson as DisputeEffectsResult), duplicate: true };
    }
    if (existing?.status === "DEAD_LETTER") {
      throw new DisputeEffectsDeadLetteredError("Dispute effects delivery is already in dead letter");
    }

    // Tenant-scoped re-read: the text (reason / resolution) never travels in the outbox (F1 decision 9).
    const dispute = await this.prisma.dispute.findFirst({
      where: { id: event.entityId, tenantId: event.tenantId },
      select: { reason: true, raisedById: true, resolution: true },
    });
    if (!dispute) {
      throw new DisputeEffectsTerminalError("Dispute not found for the event tenant");
    }

    const legacy = semseEventSchema.parse(buildLegacyDisputeEvent(event, dispute)) as LegacyDisputeEvent;
    const notifications = mapEventToNotifications(legacy.type, legacy.payload).map((spec) => ({
      userId: spec.userId,
      type: spec.type,
    }));

    if (effectsMode === "on") {
      await this.agentTriggerRouter.route(legacy, {
        tenantId: event.tenantId,
        orgId: event.orgId,
        userId: event.actor.id,
        requestId: typeof metadata.requestId === "string" ? metadata.requestId : event.eventId,
      });
      await this.notificationsService.handleEvent({
        tenantId: event.tenantId,
        eventType: legacy.type,
        payload: legacy.payload,
      });
    }

    const result: DisputeEffectsResult = {
      eventId: event.eventId,
      consumer: DISPUTE_EFFECTS_CONSUMER,
      status: "completed",
      effect: effectsMode === "on" ? "updated" : "no_op",
      effectsMode,
      legacyEventType: legacy.type,
      notifications,
      triggers: legacy.triggers,
    };

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.$executeRaw(PrismaRuntime.sql`
        INSERT INTO "DomainEventConsumption" (
          "id", "eventId", "tenantId", "consumerName", "status",
          "attempts", "maxAttempts", "nextAttemptAt", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${event.eventId}::uuid, ${event.tenantId},
          ${DISPUTE_EFFECTS_CONSUMER}, 'PENDING'::"DomainConsumptionStatus",
          0, ${MAX_ATTEMPTS}, ${now}, ${now}, ${now}
        )
        ON CONFLICT ("eventId", "consumerName") DO NOTHING
      `);
      const receipts = await tx.$queryRaw<Receipt[]>(PrismaRuntime.sql`
        SELECT "id", "status", "attempts", "resultJson" FROM "DomainEventConsumption"
        WHERE "eventId" = ${event.eventId}::uuid AND "consumerName" = ${DISPUTE_EFFECTS_CONSUMER}
        FOR UPDATE
      `);
      const receipt = receipts[0];
      if (!receipt) throw new Error("Dispute effects receipt was not created");
      if (receipt.status === "COMPLETED") {
        return { ...(receipt.resultJson as DisputeEffectsResult), duplicate: true };
      }
      if (receipt.status === "DEAD_LETTER") {
        throw new DisputeEffectsDeadLetteredError("Dispute effects delivery is already in dead letter");
      }
      await tx.auditLog.create({
        data: {
          tenantId: event.tenantId,
          actorUserId: event.actor.id,
          entityType: "Dispute",
          entityId: event.entityId,
          action: `domain_event.consumer.dispute_effects.${result.effect}`,
          afterJson: {
            eventId: event.eventId,
            correlationId: event.correlationId,
            consumer: DISPUTE_EFFECTS_CONSUMER,
            effectsMode,
            legacyEventType: legacy.type,
            notifications,
            triggers: legacy.triggers,
          },
          occurredAt: now,
        },
      });
      await tx.domainEventConsumption.update({
        where: { id: receipt.id },
        data: {
          status: "COMPLETED",
          attempts: receipt.attempts + 1,
          startedAt: now,
          completedAt: new Date(),
          nextAttemptAt: now,
          lastError: null,
          resultJson: result as Prisma.InputJsonValue,
        },
      });
      return result;
    });
  }
}
