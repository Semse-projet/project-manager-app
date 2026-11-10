/**
 * Event backbone F2, slice 1 — disputes (spec platform.event-backbone-f2-legacy-producers, D1–D4).
 *
 * Pure helpers shared by the producer (DisputesService, inside the repository transaction) and the
 * `dispute-effects.v1` consumer:
 *  - `resolveDisputeEventsV2Mode`: per-tenant flag (D1). Anything unrecognised resolves to `off`, i.e. exactly the
 *    pre-F2 behaviour.
 *  - `buildDisputeV2Event`: the canonical v2 envelope written to the outbox. The payload carries references only
 *    (F1 decision 9); `metadata.effectsMode` stamps, at production time, who owns the side effects for this event, so
 *    flipping the flag later can neither drop nor duplicate notifications for events already produced.
 *  - `buildLegacyDisputeEvent`: rebuilds the exact legacy (v1 bus) event the service emits today, from the v2 event
 *    plus the dispute re-read at consumption time. Shadow parity is measured against this, so it must stay
 *    byte-for-byte the payload the service used to build — including its known gaps (see the slice report).
 */
import { randomUUID } from "node:crypto";
import {
  DISPUTE_ASSIGNED_V1_SCHEMA_REF,
  DISPUTE_EVIDENCE_SUBMITTED_V1_SCHEMA_REF,
  DISPUTE_OPENED_V1_SCHEMA_REF,
  DISPUTE_RESOLVED_V1_SCHEMA_REF,
  DISPUTE_UNDER_REVIEW_V1_SCHEMA_REF,
  disputeAssignedV1EventSchema,
  disputeEvidenceSubmittedV1EventSchema,
  disputeOpenedV1EventSchema,
  disputeResolvedV1EventSchema,
  disputeUnderReviewV1EventSchema,
  DISPUTE_V2_EVENT_TYPES,
  type DisputeV2EventType,
  type SemseDomainEventV2,
} from "@semse/schemas";
import { buildDisputeResolvedEvent, type DisputeResolutionType } from "./disputes.events.js";

export type DisputeEventsV2Mode = "off" | "shadow" | "on";
export type DisputeEffectsMode = Exclude<DisputeEventsV2Mode, "off">;

export const DISPUTE_EFFECTS_CONSUMER = "dispute-effects.v1";
export const DISPUTE_V2_EVENT_TYPE_LIST = Object.keys(DISPUTE_V2_EVENT_TYPES) as DisputeV2EventType[];

export function resolveDisputeEventsV2Mode(
  tenantId: string,
  env: NodeJS.ProcessEnv = process.env,
): DisputeEventsV2Mode {
  const mode = (env.SEMSE_DISPUTE_EVENTS_V2_MODE ?? "off").trim().toLowerCase();
  if (mode !== "shadow" && mode !== "on") return "off";
  const tenants = (env.SEMSE_DISPUTE_EVENTS_V2_TENANT_IDS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return tenants.includes("*") || tenants.includes(tenantId) ? mode : "off";
}

export function isDisputeV2EventType(eventType: string): eventType is DisputeV2EventType {
  return Object.prototype.hasOwnProperty.call(DISPUTE_V2_EVENT_TYPES, eventType);
}

const SCHEMAS = {
  "dispute.opened.v1": { schema: disputeOpenedV1EventSchema, ref: DISPUTE_OPENED_V1_SCHEMA_REF, suffix: "opened" },
  "dispute.assigned.v1": { schema: disputeAssignedV1EventSchema, ref: DISPUTE_ASSIGNED_V1_SCHEMA_REF, suffix: "assigned" },
  "dispute.evidence_submitted.v1": {
    schema: disputeEvidenceSubmittedV1EventSchema,
    ref: DISPUTE_EVIDENCE_SUBMITTED_V1_SCHEMA_REF,
    suffix: "evidence_submitted",
  },
  "dispute.under_review.v1": {
    schema: disputeUnderReviewV1EventSchema,
    ref: DISPUTE_UNDER_REVIEW_V1_SCHEMA_REF,
    suffix: "under_review",
  },
  "dispute.resolved.v1": { schema: disputeResolvedV1EventSchema, ref: DISPUTE_RESOLVED_V1_SCHEMA_REF, suffix: "resolved" },
} as const;

export function disputeV2Schema(eventType: DisputeV2EventType) {
  return SCHEMAS[eventType].schema;
}

/** Same correlation id the legacy emit uses, so AgentTriggerRouter's idempotency key is identical on both paths. */
export function disputeCorrelationId(eventType: DisputeV2EventType, disputeId: string): string {
  return `dispute:${disputeId}:${SCHEMAS[eventType].suffix}`;
}

export function buildDisputeV2Event(input: {
  eventType: DisputeV2EventType;
  tenantId: string;
  orgId: string;
  actorUserId: string;
  requestId: string;
  effectsMode: DisputeEffectsMode;
  disputeId: string;
  payload: Record<string, unknown>;
  now?: Date;
}): SemseDomainEventV2 {
  const now = (input.now ?? new Date()).toISOString();
  const eventId = randomUUID();
  const { schema, ref } = SCHEMAS[input.eventType];
  // `opened` and `resolved` happen once per dispute; assign / evidence / review can repeat, and each write is its
  // own fact (the event is written in the same transaction as the write), so they are keyed per event.
  const anchor =
    input.eventType === "dispute.opened.v1" || input.eventType === "dispute.resolved.v1"
      ? input.disputeId
      : `${input.disputeId}:${eventId}`;
  return schema.parse({
    eventId,
    eventType: input.eventType,
    version: 1,
    envelopeVersion: 2,
    occurredAt: now,
    recordedAt: now,
    tenantId: input.tenantId,
    orgId: input.orgId,
    module: "disputes",
    entityType: "Dispute",
    entityId: input.disputeId,
    actor: { type: "user", id: input.actorUserId },
    correlationId: disputeCorrelationId(input.eventType, input.disputeId),
    idempotencyKey: `${input.eventType}:${anchor}`,
    schemaRef: ref,
    payload: input.payload,
    metadata: { source: "disputes.service", effectsMode: input.effectsMode, requestId: input.requestId },
  }) as SemseDomainEventV2;
}

/** What the consumer re-reads from the dispute row (text never travels in the outbox). */
export type DisputeSnapshot = {
  reason: string;
  raisedById: string | null;
  resolution: string | null;
};

export type LegacyDisputeEvent = {
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

/**
 * Rebuilds the legacy event the service emits for the same write. Kept in lock-step with DisputesService; the
 * parity test compares both paths for every event type.
 */
export function buildLegacyDisputeEvent(
  event: Pick<SemseDomainEventV2, "eventType" | "tenantId" | "actor" | "occurredAt" | "payload">,
  dispute: DisputeSnapshot,
): LegacyDisputeEvent {
  if (!isDisputeV2EventType(event.eventType)) {
    throw new Error(`Unsupported dispute event type: ${event.eventType}`);
  }
  const p = event.payload as Record<string, unknown> & { disputeId: string; jobId: string; projectId: string };
  const meta = {
    tenantId: event.tenantId,
    correlationId: disputeCorrelationId(event.eventType, p.disputeId),
    actorId: event.actor.id,
    actorType: "user" as const,
    occurredAt: event.occurredAt,
    version: 1 as const,
  };
  switch (event.eventType) {
    case "dispute.opened.v1":
      return {
        type: "dispute.opened",
        meta,
        payload: {
          disputeId: p.disputeId,
          jobId: p.jobId,
          projectId: p.projectId,
          raisedById: dispute.raisedById ?? p.raisedById,
          reasonCode: "manual_open",
          reason: dispute.reason,
        },
        triggers: ["dispute", "risk", "notification", "audit"],
      };
    case "dispute.assigned.v1":
      return {
        type: "dispute.assigned",
        meta,
        payload: { disputeId: p.disputeId, assigneeId: p.assigneeUserId, jobId: p.jobId, projectId: p.projectId },
        triggers: ["notification", "audit"],
      };
    case "dispute.evidence_submitted.v1":
      return {
        type: "dispute.evidence_submitted",
        meta,
        payload: {
          disputeId: p.disputeId,
          jobId: p.jobId,
          projectId: p.projectId,
          submittedById: p.submittedById,
          evidenceIds: p.evidenceIds,
          totalEvidenceCount: p.totalEvidenceCount,
        },
        triggers: [],
      };
    case "dispute.under_review.v1":
      return {
        type: "dispute.under_review",
        meta,
        payload: {
          disputeId: p.disputeId,
          jobId: p.jobId,
          projectId: p.projectId,
          assigneeUserId: p.assigneeUserId ?? undefined,
          evidenceCount: p.evidenceCount,
        },
        triggers: [],
      };
    case "dispute.resolved.v1": {
      const legacy = buildDisputeResolvedEvent({
        tenantId: event.tenantId,
        disputeId: p.disputeId,
        jobId: p.jobId,
        resolvedById: String(p.resolvedById),
        resolutionType: p.resolutionType as DisputeResolutionType,
        resolution: dispute.resolution ?? "",
        occurredAt: event.occurredAt,
      });
      return { ...legacy, meta: { ...legacy.meta, actorId: event.actor.id }, triggers: [...legacy.triggers] };
    }
  }
}
