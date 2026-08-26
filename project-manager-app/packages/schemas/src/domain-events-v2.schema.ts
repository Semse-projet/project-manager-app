import { z } from "zod";

import { evidenceUploadedEventSchema } from "./domain-events.schema.js";

export const EVIDENCE_UPLOADED_V1_SCHEMA_REF =
  "semse://schemas/events/evidence.uploaded.v1" as const;
export const PROJECT_LIFECYCLE_SOURCE_CHANGED_V1_SCHEMA_REF =
  "semse://schemas/events/project.lifecycle-source-changed.v1" as const;
export const JOB_CREATED_V1_SCHEMA_REF =
  "semse://schemas/events/job.created.v1" as const;
export const JOB_STATUS_CHANGED_V1_SCHEMA_REF =
  "semse://schemas/events/job.status_changed.v1" as const;
export const JOB_PREFERRED_PROFESSIONAL_SELECTED_V1_SCHEMA_REF =
  "semse://schemas/events/job.preferred_professional_selected.v1" as const;
export const BID_CREATED_V1_SCHEMA_REF =
  "semse://schemas/events/bid.created.v1" as const;
export const BID_ACCEPTED_V1_SCHEMA_REF =
  "semse://schemas/events/bid.accepted.v1" as const;
export const BID_REJECTED_V1_SCHEMA_REF =
  "semse://schemas/events/bid.rejected.v1" as const;

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

export const projectLifecycleSourceChangedV1PayloadSchema = z
  .object({
    projectId: nonEmptyId,
    sourceEventType: nonEmptyId,
    sourceEntityType: nonEmptyId,
    sourceEntityId: nonEmptyId,
  })
  .strict();

const projectLifecycleSourceChangedV1EventObjectSchema =
  semseDomainEventV2ObjectSchema.extend({
    eventType: z.literal("project.lifecycle-source-changed.v1"),
    version: z.literal(1),
    envelopeVersion: z.literal(2),
    module: z.literal("projects"),
    entityType: z.literal("Project"),
    schemaRef: z.literal(PROJECT_LIFECYCLE_SOURCE_CHANGED_V1_SCHEMA_REF),
    payload: projectLifecycleSourceChangedV1PayloadSchema,
  });

export const projectLifecycleSourceChangedV1EventSchema =
  projectLifecycleSourceChangedV1EventObjectSchema.superRefine(
    (value, ctx) => {
      validateEnvelopeV2(value, ctx);

      if (
        value.entityId !== value.payload.projectId
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entityId"],
          message: "entityId must match payload.projectId",
        });
      }
    },
  );

export type ProjectLifecycleSourceChangedV1Event = z.infer<
  typeof projectLifecycleSourceChangedV1EventSchema
>;

// Jobs & Bids Event Projection (docs/specs/operations/jobs-bids-event-projection.spec.md)
// module="jobs"/entityType="Job" for job.*, module="bids"/entityType="Bid" for bid.*

export const jobCreatedV1PayloadSchema = z
  .object({
    jobId: nonEmptyId,
    clientOrgId: nonEmptyId,
    title: z.string().trim().min(1).max(500),
    category: z.string().trim().min(1).max(255).optional(),
    scope: z.string().trim().min(1),
    budgetType: z.string().trim().min(1).max(64).optional(),
    budgetMin: z.number().nonnegative().optional(),
    budgetMax: z.number().nonnegative().optional(),
    location: z.string().trim().min(1).max(500).optional(),
    urgency: z.string().trim().min(1).max(64).optional(),
    deadline: z.string().datetime().optional(),
  })
  .strict();

const jobCreatedV1EventObjectSchema = semseDomainEventV2ObjectSchema.extend({
  eventType: z.literal("job.created.v1"),
  version: z.literal(1),
  envelopeVersion: z.literal(2),
  module: z.literal("jobs"),
  entityType: z.literal("Job"),
  schemaRef: z.literal(JOB_CREATED_V1_SCHEMA_REF),
  payload: jobCreatedV1PayloadSchema,
});

export const jobCreatedV1EventSchema = jobCreatedV1EventObjectSchema.superRefine(
  (value, ctx) => {
    validateEnvelopeV2(value, ctx);
    if (value.entityId !== value.payload.jobId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entityId"],
        message: "entityId must match payload.jobId",
      });
    }
  },
);

export type JobCreatedV1Event = z.infer<typeof jobCreatedV1EventSchema>;

export const jobStatusChangedV1PayloadSchema = z
  .object({
    jobId: nonEmptyId,
    fromStatus: nonEmptyId,
    toStatus: nonEmptyId,
  })
  .strict();

const jobStatusChangedV1EventObjectSchema = semseDomainEventV2ObjectSchema.extend({
  eventType: z.literal("job.status_changed.v1"),
  version: z.literal(1),
  envelopeVersion: z.literal(2),
  module: z.literal("jobs"),
  entityType: z.literal("Job"),
  schemaRef: z.literal(JOB_STATUS_CHANGED_V1_SCHEMA_REF),
  payload: jobStatusChangedV1PayloadSchema,
});

export const jobStatusChangedV1EventSchema =
  jobStatusChangedV1EventObjectSchema.superRefine((value, ctx) => {
    validateEnvelopeV2(value, ctx);
    if (value.entityId !== value.payload.jobId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entityId"],
        message: "entityId must match payload.jobId",
      });
    }
  });

export type JobStatusChangedV1Event = z.infer<
  typeof jobStatusChangedV1EventSchema
>;

export const jobPreferredProfessionalSelectedV1PayloadSchema = z
  .object({
    jobId: nonEmptyId,
    preferredProfessionalUserId: nonEmptyId,
    preferredProfessionalDisplayName: z.string().trim().min(1).max(255),
    preferredProfessionalPublicSlug: z.string().trim().min(1).max(255).nullable(),
  })
  .strict();

const jobPreferredProfessionalSelectedV1EventObjectSchema =
  semseDomainEventV2ObjectSchema.extend({
    eventType: z.literal("job.preferred_professional_selected.v1"),
    version: z.literal(1),
    envelopeVersion: z.literal(2),
    module: z.literal("jobs"),
    entityType: z.literal("Job"),
    schemaRef: z.literal(JOB_PREFERRED_PROFESSIONAL_SELECTED_V1_SCHEMA_REF),
    payload: jobPreferredProfessionalSelectedV1PayloadSchema,
  });

export const jobPreferredProfessionalSelectedV1EventSchema =
  jobPreferredProfessionalSelectedV1EventObjectSchema.superRefine((value, ctx) => {
    validateEnvelopeV2(value, ctx);
    if (value.entityId !== value.payload.jobId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entityId"],
        message: "entityId must match payload.jobId",
      });
    }
  });

export type JobPreferredProfessionalSelectedV1Event = z.infer<
  typeof jobPreferredProfessionalSelectedV1EventSchema
>;

export const bidCreatedV1PayloadSchema = z
  .object({
    bidId: nonEmptyId,
    jobId: nonEmptyId,
    proOrgId: nonEmptyId,
    professionalUserId: nonEmptyId,
    amount: z.number().nonnegative(),
    etaDays: z.number().int().nonnegative(),
  })
  .strict();

const bidCreatedV1EventObjectSchema = semseDomainEventV2ObjectSchema.extend({
  eventType: z.literal("bid.created.v1"),
  version: z.literal(1),
  envelopeVersion: z.literal(2),
  module: z.literal("bids"),
  entityType: z.literal("Bid"),
  schemaRef: z.literal(BID_CREATED_V1_SCHEMA_REF),
  payload: bidCreatedV1PayloadSchema,
});

export const bidCreatedV1EventSchema = bidCreatedV1EventObjectSchema.superRefine(
  (value, ctx) => {
    validateEnvelopeV2(value, ctx);
    if (value.entityId !== value.payload.bidId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entityId"],
        message: "entityId must match payload.bidId",
      });
    }
  },
);

export type BidCreatedV1Event = z.infer<typeof bidCreatedV1EventSchema>;

export const bidAcceptedV1PayloadSchema = z
  .object({
    bidId: nonEmptyId,
    jobId: nonEmptyId,
    proOrgId: nonEmptyId,
  })
  .strict();

const bidAcceptedV1EventObjectSchema = semseDomainEventV2ObjectSchema.extend({
  eventType: z.literal("bid.accepted.v1"),
  version: z.literal(1),
  envelopeVersion: z.literal(2),
  module: z.literal("bids"),
  entityType: z.literal("Bid"),
  schemaRef: z.literal(BID_ACCEPTED_V1_SCHEMA_REF),
  payload: bidAcceptedV1PayloadSchema,
});

export const bidAcceptedV1EventSchema = bidAcceptedV1EventObjectSchema.superRefine(
  (value, ctx) => {
    validateEnvelopeV2(value, ctx);
    if (value.entityId !== value.payload.bidId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entityId"],
        message: "entityId must match payload.bidId",
      });
    }
  },
);

export type BidAcceptedV1Event = z.infer<typeof bidAcceptedV1EventSchema>;

export const bidRejectedV1PayloadSchema = z
  .object({
    bidId: nonEmptyId,
    jobId: nonEmptyId,
    proOrgId: nonEmptyId,
    reason: z.literal("competing_bid_accepted"),
  })
  .strict();

const bidRejectedV1EventObjectSchema = semseDomainEventV2ObjectSchema.extend({
  eventType: z.literal("bid.rejected.v1"),
  version: z.literal(1),
  envelopeVersion: z.literal(2),
  module: z.literal("bids"),
  entityType: z.literal("Bid"),
  schemaRef: z.literal(BID_REJECTED_V1_SCHEMA_REF),
  payload: bidRejectedV1PayloadSchema,
});

export const bidRejectedV1EventSchema = bidRejectedV1EventObjectSchema.superRefine(
  (value, ctx) => {
    validateEnvelopeV2(value, ctx);
    if (value.entityId !== value.payload.bidId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entityId"],
        message: "entityId must match payload.bidId",
      });
    }
  },
);

export type BidRejectedV1Event = z.infer<typeof bidRejectedV1EventSchema>;

// F10 — originador/facilitador (docs/specs/core/originador-referral-program.spec.md)
export const PROJECT_ORIGINATOR_PROPOSED_V1_SCHEMA_REF =
  "semse://schemas/events/project.originator_proposed.v1" as const;
export const PROJECT_ORIGINATOR_VALIDATED_V1_SCHEMA_REF =
  "semse://schemas/events/project.originator_validated.v1" as const;

export const projectOriginatorProposedV1PayloadSchema = z
  .object({
    projectOriginatorId: nonEmptyId,
    projectId: nonEmptyId,
    originatorUserId: nonEmptyId,
  })
  .strict();

const projectOriginatorProposedV1EventObjectSchema =
  semseDomainEventV2ObjectSchema.extend({
    eventType: z.literal("project.originator_proposed.v1"),
    version: z.literal(1),
    envelopeVersion: z.literal(2),
    module: z.literal("originator"),
    entityType: z.literal("ProjectOriginator"),
    schemaRef: z.literal(PROJECT_ORIGINATOR_PROPOSED_V1_SCHEMA_REF),
    payload: projectOriginatorProposedV1PayloadSchema,
  });

export const projectOriginatorProposedV1EventSchema =
  projectOriginatorProposedV1EventObjectSchema.superRefine((value, ctx) => {
    validateEnvelopeV2(value, ctx);
    if (value.entityId !== value.payload.projectOriginatorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entityId"],
        message: "entityId must match payload.projectOriginatorId",
      });
    }
  });

export type ProjectOriginatorProposedV1Event = z.infer<
  typeof projectOriginatorProposedV1EventSchema
>;

export const projectOriginatorValidatedV1PayloadSchema = z
  .object({
    projectOriginatorId: nonEmptyId,
    projectId: nonEmptyId,
    originatorUserId: nonEmptyId,
    decision: z.enum(["VALIDATED", "REJECTED"]),
  })
  .strict();

const projectOriginatorValidatedV1EventObjectSchema =
  semseDomainEventV2ObjectSchema.extend({
    eventType: z.literal("project.originator_validated.v1"),
    version: z.literal(1),
    envelopeVersion: z.literal(2),
    module: z.literal("originator"),
    entityType: z.literal("ProjectOriginator"),
    schemaRef: z.literal(PROJECT_ORIGINATOR_VALIDATED_V1_SCHEMA_REF),
    payload: projectOriginatorValidatedV1PayloadSchema,
  });

export const projectOriginatorValidatedV1EventSchema =
  projectOriginatorValidatedV1EventObjectSchema.superRefine((value, ctx) => {
    validateEnvelopeV2(value, ctx);
    if (value.entityId !== value.payload.projectOriginatorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entityId"],
        message: "entityId must match payload.projectOriginatorId",
      });
    }
  });

export type ProjectOriginatorValidatedV1Event = z.infer<
  typeof projectOriginatorValidatedV1EventSchema
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
