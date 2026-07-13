import { z } from "zod";

import { evidenceUploadedEventSchema } from "./domain-events.schema.js";

export const EVIDENCE_UPLOADED_V1_SCHEMA_REF =
  "semse://schemas/events/evidence.uploaded.v1" as const;

const nonEmptyId = z.string().trim().min(1).max(255);
const eventTypeSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9_-]*)+\.v[1-9]\d*$/,
    "eventType must use aggregate.action.vN format",
  );

export const semseDomainEventActorV2Schema = z
  .object({
    type: z.enum(["user", "system", "agent", "webhook"]),
    id: nonEmptyId,
  })
  .strict();

export const semseTraceContextSchema = z
  .object({
    traceparent: z
      .string()
      .regex(/^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i),
    tracestate: z.string().trim().min(1).max(512).optional(),
  })
  .strict();

const semseDomainEventV2ObjectSchema = z
  .object({
    eventId: z.string().uuid(),
    eventType: eventTypeSchema,
    version: z.number().int().positive(),
    envelopeVersion: z.literal(2),
    occurredAt: z.string().datetime(),
    recordedAt: z.string().datetime(),
    tenantId: nonEmptyId,
    orgId: nonEmptyId,
    module: nonEmptyId,
    entityType: nonEmptyId,
    entityId: nonEmptyId,
    actor: semseDomainEventActorV2Schema,
    correlationId: nonEmptyId,
    causationId: nonEmptyId.optional(),
    idempotencyKey: z.string().trim().min(1).max(512),
    schemaRef: z.string().trim().min(1).max(512),
    traceContext: semseTraceContextSchema.optional(),
    payload: z.record(z.unknown()),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

type SemseDomainEventV2Input = z.infer<typeof semseDomainEventV2ObjectSchema>;

function validateEnvelopeV2(
  value: SemseDomainEventV2Input,
  ctx: z.RefinementCtx,
): void {
  const versionSuffix = value.eventType.match(/\.v([1-9]\d*)$/)?.[1];
  if (!versionSuffix || Number(versionSuffix) !== value.version) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["version"],
      message: "version must match the .vN eventType suffix",
    });
  }

  if (Date.parse(value.occurredAt) > Date.parse(value.recordedAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["occurredAt"],
      message: "occurredAt cannot be later than recordedAt",
    });
  }
}

export const semseDomainEventV2Schema =
  semseDomainEventV2ObjectSchema.superRefine(validateEnvelopeV2);

export type SemseDomainEventV2 = z.infer<typeof semseDomainEventV2Schema>;

export const evidenceUploadedV1PayloadSchema = z
  .object({
    evidenceId: nonEmptyId,
    projectId: nonEmptyId,
    jobId: nonEmptyId,
    milestoneId: nonEmptyId.optional(),
    uploaderId: nonEmptyId,
    kind: z.enum(["PHOTO", "VIDEO", "DOCUMENT"]),
    bucketKey: z
      .string()
      .trim()
      .min(1)
      .max(2048)
      .refine((value) => !value.includes("://") && !value.includes("?"), {
        message: "bucketKey must be an internal storage reference",
      }),
    checksum: z
      .string()
      .regex(/^[0-9a-f]{64}$/i)
      .optional(),
    capturedAt: z.string().datetime().optional(),
    geo: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .strict()
      .optional(),
  })
  .strict();

const evidenceUploadedV1EventObjectSchema =
  semseDomainEventV2ObjectSchema.extend({
    eventType: z.literal("evidence.uploaded.v1"),
    version: z.literal(1),
    envelopeVersion: z.literal(2),
    module: z.literal("evidence"),
    entityType: z.literal("Evidence"),
    schemaRef: z.literal(EVIDENCE_UPLOADED_V1_SCHEMA_REF),
    payload: evidenceUploadedV1PayloadSchema,
  });

export const evidenceUploadedV1EventSchema =
  evidenceUploadedV1EventObjectSchema.superRefine((value, ctx) => {
    validateEnvelopeV2(value, ctx);

    if (value.entityId !== value.payload.evidenceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entityId"],
        message: "entityId must match payload.evidenceId",
      });
    }

    if (
      value.actor.type === "user" &&
      value.actor.id !== value.payload.uploaderId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actor", "id"],
        message: "user actor must match payload.uploaderId",
      });
    }
  });

export type EvidenceUploadedV1Event = z.infer<
  typeof evidenceUploadedV1EventSchema
>;

export function toLegacySemseEventV1(event: EvidenceUploadedV1Event) {
  if (event.actor.type === "webhook") {
    throw new Error("Webhook actors cannot be projected to SemseEvent v1");
  }

  return evidenceUploadedEventSchema.parse({
    type: "evidence.uploaded",
    meta: {
      tenantId: event.tenantId,
      correlationId: event.correlationId,
      actorId: event.actor.id,
      actorType: event.actor.type,
      occurredAt: event.occurredAt,
      version: 1,
    },
    payload: {
      evidenceId: event.payload.evidenceId,
      projectId: event.payload.projectId,
      milestoneId: event.payload.milestoneId,
      uploaderId: event.payload.uploaderId,
      kind: event.payload.kind,
      bucketKey: event.payload.bucketKey,
      geoLat: event.payload.geo?.lat,
      geoLng: event.payload.geo?.lng,
    },
    triggers: ["evidence-coach", "audit"],
  });
}
