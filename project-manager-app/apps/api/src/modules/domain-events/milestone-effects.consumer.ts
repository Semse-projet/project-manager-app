import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { DomainOutboxEvent, Prisma } from "@prisma/client";
import prismaClientPackage from "../../../../../node_modules/.prisma/client/index.js";
import { semseEventSchema } from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { mapEventToNotifications, NotificationsService } from "../notifications/notifications.service.js";
import { loadMilestoneEventContext } from "../milestones/milestones.repository.js";
import {
  buildLegacyMilestoneEvents,
  isMilestoneV2EventType,
  MILESTONE_EFFECTS_CONSUMER,
  milestoneV2Schema,
  type LegacyMilestoneEvent,
  type MilestoneEffectsMode,
} from "../milestones/milestone-events-v2.js";
import { AgentTriggerRouter } from "./agent-trigger-router.service.js";

const { Prisma: PrismaRuntime } = prismaClientPackage as typeof import("../../../../../node_modules/.prisma/client/index.js");

export { MILESTONE_EFFECTS_CONSUMER } from "../milestones/milestone-events-v2.js";

const MAX_ATTEMPTS = 5;

/** The event can never succeed (unknown type, invalid envelope, milestone missing for its tenant): dead-letter now. */
export class MilestoneEffectsTerminalError extends Error {}
/** The receipt is already in DEAD_LETTER; only an operator replay may move it. */
export class MilestoneEffectsDeadLetteredError extends Error {}

export type MilestoneEffectsResult = {
  eventId: string;
  consumer: typeof MILESTONE_EFFECTS_CONSUMER;
  status: "completed";
  effect: "updated" | "no_op";
  effectsMode: MilestoneEffectsMode;
  legacyEventType: string;
  notifications: Array<{ userId: string; type: string }>;
  triggers: string[];
  duplicate?: boolean;
};

type Receipt = { id: string; status: string; attempts: number; resultJson: unknown };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * Event backbone F2, slice 2b (plan event-backbone-f2-milestones.plan.md §2b). Same contract as
 * `dispute-effects.v1`: rebuilds the legacy milestone event (and, for `approved`, the direct professional
 * notification) from the v2 event plus the milestone re-read for its tenant; `on` runs agent triggers first, then
 * notifications; `shadow` only records what it would have produced. Registered with `appliesTo` = stamped effects
 * mode, so it shares `approved/rejected.v1` with `satellite-webhooks.v1` (fan-out) without touching the SAT-007
 * best-effort events that carry no mode.
 */
@Injectable()
export class MilestoneEffectsConsumer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly agentTriggerRouter: AgentTriggerRouter,
  ) {}

  async consume(stored: DomainOutboxEvent): Promise<MilestoneEffectsResult> {
    if (!isMilestoneV2EventType(stored.eventType)) {
      throw new MilestoneEffectsTerminalError(`Unsupported milestone event type: ${stored.eventType}`);
    }
    const parsed = milestoneV2Schema(stored.eventType).safeParse({
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
      throw new MilestoneEffectsTerminalError(
        `Invalid milestone event: ${parsed.error.issues[0]?.message ?? "schema validation failed"}`,
      );
    }
    const event = parsed.data;
    const metadata = record(event.metadata);
    const effectsMode: MilestoneEffectsMode = metadata.effectsMode === "on" ? "on" : "shadow";

    const existing = await this.prisma.domainEventConsumption.findUnique({
      where: { eventId_consumerName: { eventId: event.eventId, consumerName: MILESTONE_EFFECTS_CONSUMER } },
      select: { status: true, resultJson: true },
    });
    if (existing?.status === "COMPLETED") {
      return { ...(existing.resultJson as MilestoneEffectsResult), duplicate: true };
    }
    if (existing?.status === "DEAD_LETTER") {
      throw new MilestoneEffectsDeadLetteredError("Milestone effects delivery is already in dead letter");
    }

    // Tenant-scoped re-read (title and participants never travel in the outbox).
    const [row, context] = await Promise.all([
      this.prisma.milestone.findFirst({
        where: { id: event.entityId, project: { tenantId: event.tenantId } },
        select: { title: true },
      }),
      loadMilestoneEventContext(this.prisma, { tenantId: event.tenantId, milestoneId: event.entityId }),
    ]);
    if (!row || !context) {
      throw new MilestoneEffectsTerminalError("Milestone not found for the event tenant");
    }

    const rebuilt = buildLegacyMilestoneEvents(event, {
      title: row.title,
      proUserId: context.proUserId,
      clientUserId: context.clientUserId,
    });
    const legacy = semseEventSchema.parse(rebuilt.legacy) as LegacyMilestoneEvent;
    const notifications = [
      ...mapEventToNotifications(legacy.type, legacy.payload),
      ...rebuilt.direct.flatMap((d) => mapEventToNotifications(d.eventType, d.payload)),
    ].map((spec) => ({ userId: spec.userId, type: spec.type }));

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
      for (const direct of rebuilt.direct) {
        await this.notificationsService.handleEvent({
          tenantId: event.tenantId,
          eventType: direct.eventType,
          payload: direct.payload,
        });
      }
    }

    const result: MilestoneEffectsResult = {
      eventId: event.eventId,
      consumer: MILESTONE_EFFECTS_CONSUMER,
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
          ${MILESTONE_EFFECTS_CONSUMER}, 'PENDING'::"DomainConsumptionStatus",
          0, ${MAX_ATTEMPTS}, ${now}, ${now}, ${now}
        )
        ON CONFLICT ("eventId", "consumerName") DO NOTHING
      `);
      const receipts = await tx.$queryRaw<Receipt[]>(PrismaRuntime.sql`
        SELECT "id", "status", "attempts", "resultJson" FROM "DomainEventConsumption"
        WHERE "eventId" = ${event.eventId}::uuid AND "consumerName" = ${MILESTONE_EFFECTS_CONSUMER}
        FOR UPDATE
      `);
      const receipt = receipts[0];
      if (!receipt) throw new Error("Milestone effects receipt was not created");
      if (receipt.status === "COMPLETED") {
        return { ...(receipt.resultJson as MilestoneEffectsResult), duplicate: true };
      }
      if (receipt.status === "DEAD_LETTER") {
        throw new MilestoneEffectsDeadLetteredError("Milestone effects delivery is already in dead letter");
      }
      await tx.auditLog.create({
        data: {
          tenantId: event.tenantId,
          actorUserId: event.actor.id,
          entityType: "Milestone",
          entityId: event.entityId,
          action: `domain_event.consumer.milestone_effects.${result.effect}`,
          afterJson: {
            eventId: event.eventId,
            correlationId: event.correlationId,
            consumer: MILESTONE_EFFECTS_CONSUMER,
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
