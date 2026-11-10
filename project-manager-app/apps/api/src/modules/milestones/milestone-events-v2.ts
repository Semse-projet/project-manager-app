/**
 * Event backbone F2, slice 2b — milestones (spec platform.event-backbone-f2-legacy-producers, D1–D5;
 * plan event-backbone-f2-milestones.plan.md §2b). Same shape as the disputes slice (dispute-events-v2.ts):
 *  - `resolveMilestoneEventsV2Mode`: per-tenant flag; anything unrecognised is `off` (exactly the pre-F2 behaviour,
 *    including the SAT-007 best-effort writes of `approved/rejected.v1`).
 *  - `buildMilestoneV2Event`: canonical envelope; `metadata.effectsMode` stamps who owns the side effects of this
 *    event. `approved.v1` / `rejected.v1` keep their SAT-007 correlation ids and payloads (D4).
 *  - `buildLegacyMilestoneEvents`: rebuilds, from the v2 event plus the milestone re-read at consumption time, the
 *    legacy bus event the service emits today and — for `approved` — the direct notification the service sends
 *    alongside it. Parity with the service is tested for every type.
 */
import { randomUUID } from "node:crypto";
import {
  MILESTONE_APPROVED_V1_SCHEMA_REF,
  MILESTONE_CREATED_V1_SCHEMA_REF,
  MILESTONE_REJECTED_V1_SCHEMA_REF,
  MILESTONE_REVISION_REQUESTED_V1_SCHEMA_REF,
  MILESTONE_SUBMITTED_V1_SCHEMA_REF,
  MILESTONE_V2_EVENT_TYPES,
  milestoneApprovedV1EventSchema,
  milestoneCreatedV1EventSchema,
  milestoneRejectedV1EventSchema,
  milestoneRevisionRequestedV1EventSchema,
  milestoneSubmittedV1EventSchema,
  type MilestoneV2EventType,
  type SemseDomainEventV2,
} from "@semse/schemas";
import {
  buildMilestoneApprovedEvent,
  buildMilestoneCreatedEvent,
  buildMilestoneRejectedEvent,
  buildMilestoneRevisionRequestedEvent,
} from "./milestones.events.js";

export type MilestoneEventsV2Mode = "off" | "shadow" | "on";
export type MilestoneEffectsMode = Exclude<MilestoneEventsV2Mode, "off">;

export const MILESTONE_EFFECTS_CONSUMER = "milestone-effects.v1";
export const MILESTONE_V2_EVENT_TYPE_LIST = Object.keys(MILESTONE_V2_EVENT_TYPES) as MilestoneV2EventType[];
/** Same bound as the v2 payloads (`rejectionReason`, `instructions`); enforced before the write in every mode. */
export const MILESTONE_REASON_MAX_LENGTH = 2000;

export function resolveMilestoneEventsV2Mode(
  tenantId: string,
  env: NodeJS.ProcessEnv = process.env,
): MilestoneEventsV2Mode {
  const mode = (env.SEMSE_MILESTONE_EVENTS_V2_MODE ?? "off").trim().toLowerCase();
  if (mode !== "shadow" && mode !== "on") return "off";
  const tenants = (env.SEMSE_MILESTONE_EVENTS_V2_TENANT_IDS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return tenants.includes("*") || tenants.includes(tenantId) ? mode : "off";
}

export function isMilestoneV2EventType(eventType: string): eventType is MilestoneV2EventType {
  return Object.prototype.hasOwnProperty.call(MILESTONE_V2_EVENT_TYPES, eventType);
}

/** A milestone event takes part in milestone-effects.v1 only when a v2 producer stamped its effects mode. */
export function hasStampedEffectsMode(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const mode = (metadata as Record<string, unknown>).effectsMode;
  return mode === "shadow" || mode === "on";
}

const SCHEMAS = {
  "milestone.created.v1": { schema: milestoneCreatedV1EventSchema, ref: MILESTONE_CREATED_V1_SCHEMA_REF, action: "created" },
  "milestone.submitted.v1": { schema: milestoneSubmittedV1EventSchema, ref: MILESTONE_SUBMITTED_V1_SCHEMA_REF, action: "submitted" },
  "milestone.approved.v1": { schema: milestoneApprovedV1EventSchema, ref: MILESTONE_APPROVED_V1_SCHEMA_REF, action: "approved" },
  "milestone.rejected.v1": { schema: milestoneRejectedV1EventSchema, ref: MILESTONE_REJECTED_V1_SCHEMA_REF, action: "rejected" },
  "milestone.revision_requested.v1": {
    schema: milestoneRevisionRequestedV1EventSchema,
    ref: MILESTONE_REVISION_REQUESTED_V1_SCHEMA_REF,
    action: "revision_requested",
  },
} as const;

export function milestoneV2Schema(eventType: MilestoneV2EventType) {
  return SCHEMAS[eventType].schema;
}

/** The legacy correlation id (`milestone:<id>:<action>`) — what AgentTriggerRouter keys its idempotency on. */
export function legacyMilestoneCorrelationId(eventType: MilestoneV2EventType, milestoneId: string): string {
  return `milestone:${milestoneId}:${SCHEMAS[eventType].action}`;
}

export function buildMilestoneV2Event(input: {
  eventType: MilestoneV2EventType;
  tenantId: string;
  orgId: string;
  actorUserId: string;
  requestId: string;
  effectsMode: MilestoneEffectsMode;
  milestoneId: string;
  payload: Record<string, unknown>;
  now?: Date;
}): SemseDomainEventV2 {
  const now = (input.now ?? new Date()).toISOString();
  const eventId = randomUUID();
  const { schema, ref } = SCHEMAS[input.eventType];
  // approved/rejected keep the SAT-007 correlation and per-event idempotency key (D4: payload and keys unchanged).
  const sat007 = input.eventType === "milestone.approved.v1" || input.eventType === "milestone.rejected.v1";
  const anchor = input.eventType === "milestone.created.v1" ? input.milestoneId : `${input.milestoneId}:${eventId}`;
  return schema.parse({
    eventId,
    eventType: input.eventType,
    version: 1,
    envelopeVersion: 2,
    occurredAt: now,
    recordedAt: now,
    tenantId: input.tenantId,
    orgId: input.orgId,
    module: "milestones",
    entityType: "Milestone",
    entityId: input.milestoneId,
    actor: { type: "user", id: input.actorUserId },
    correlationId: sat007
      ? `${input.eventType}:${input.milestoneId}`
      : legacyMilestoneCorrelationId(input.eventType, input.milestoneId),
    idempotencyKey: `${input.eventType}:${anchor}`,
    schemaRef: ref,
    payload: input.payload,
    metadata: { source: "milestones.service", effectsMode: input.effectsMode, requestId: input.requestId },
  }) as SemseDomainEventV2;
}

/** What the consumer re-reads at consumption time (title is never copied into the outbox). */
export type MilestoneSnapshot = {
  title: string;
  proUserId: string | null;
  clientUserId: string | null;
};

export type LegacyMilestoneEvent = {
  type: string;
  meta: {
    tenantId: string;
    correlationId: string;
    actorId: string;
    actorType: "user";
    occurredAt: string;
    version: 1;
  };
  payload: Record<string, unknown>;
  triggers: string[];
};

/** A notification the service sends directly (outside the bus) for the same write. */
export type DirectMilestoneNotification = { eventType: string; payload: Record<string, unknown> };

export function buildLegacyMilestoneEvents(
  event: Pick<SemseDomainEventV2, "eventType" | "tenantId" | "actor" | "occurredAt" | "payload">,
  milestone: MilestoneSnapshot,
): { legacy: LegacyMilestoneEvent; direct: DirectMilestoneNotification[] } {
  if (!isMilestoneV2EventType(event.eventType)) {
    throw new Error(`Unsupported milestone event type: ${event.eventType}`);
  }
  const p = event.payload as Record<string, unknown> & { milestoneId: string; projectId: string; jobId: string };
  const base = {
    tenantId: event.tenantId,
    milestoneId: p.milestoneId,
    actorId: event.actor.id,
    occurredAt: event.occurredAt,
  };
  const mutable = (e: { triggers: readonly string[] }) => ({ ...e, triggers: [...e.triggers] }) as LegacyMilestoneEvent;

  switch (event.eventType) {
    case "milestone.created.v1":
      return {
        legacy: mutable(buildMilestoneCreatedEvent({
          ...base,
          projectId: p.projectId,
          jobId: p.jobId,
          sequence: Number(p.sequence),
          title: milestone.title,
          amount: Number(p.amount),
        })),
        direct: [],
      };
    case "milestone.submitted.v1": {
      const evidenceCount = Number(p.evidenceCount);
      return {
        legacy: {
          type: "milestone.submitted",
          meta: {
            tenantId: event.tenantId,
            correlationId: legacyMilestoneCorrelationId(event.eventType, p.milestoneId),
            actorId: event.actor.id,
            actorType: "user",
            occurredAt: event.occurredAt,
            version: 1,
          },
          payload: {
            milestoneId: p.milestoneId,
            projectId: p.projectId,
            jobId: p.jobId,
            professionalId: p.professionalId,
            evidenceCount,
            checklistComplete: evidenceCount > 0,
            submittedAt: event.occurredAt,
            clientUserId: milestone.clientUserId,
          },
          triggers: ["evidence-coach", "notification", "audit"],
        },
        direct: [],
      };
    }
    case "milestone.approved.v1":
      return {
        legacy: mutable(buildMilestoneApprovedEvent({
          ...base,
          projectId: p.projectId,
          jobId: p.jobId,
          amount: Number(p.amount),
        })),
        direct: milestone.proUserId
          ? [{
              eventType: "milestone.approved",
              payload: {
                proUserId: milestone.proUserId,
                milestoneId: p.milestoneId,
                projectId: p.projectId,
                jobId: p.jobId,
              },
            }]
          : [],
      };
    case "milestone.rejected.v1":
      return {
        legacy: mutable(buildMilestoneRejectedEvent({
          ...base,
          projectId: p.projectId,
          jobId: p.jobId,
          reason: String(p.rejectionReason),
        })),
        direct: [],
      };
    case "milestone.revision_requested.v1":
      return {
        legacy: mutable(buildMilestoneRevisionRequestedEvent({
          ...base,
          projectId: p.projectId,
          jobId: p.jobId,
          reason: String(p.instructions),
        })),
        direct: [],
      };
  }
}
