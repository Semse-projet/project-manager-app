/**
 * SEMSE OS — Domain Events Schema
 * =================================
 * Todos los eventos de dominio del sistema, tipados con Zod.
 *
 * Arquitectura:
 *   Cada evento tiene:
 *   - `type`     — discriminante único (string literal)
 *   - `meta`     — metadatos comunes: tenantId, correlationId, actorId, actorType, occurredAt
 *   - `payload`  — datos específicos del evento
 *   - `triggers` — qué agentes deben reaccionar a este evento (opcional)
 *
 * Uso en el sistema:
 *   1. Service emite evento → `eventBus.emit(jobCreatedEvent.parse(...))`
 *   2. BullMQ lo encola
 *   3. Worker lo recibe y dispara lógica reactiva (agentes, notificaciones, audit)
 *   4. AuditLog registra cada emisión con firma
 *
 * @version 1.0 — Marzo 2026
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// METADATA COMÚN
// ─────────────────────────────────────────────────────────────────────────────

export const eventMetaSchema = z.object({
  tenantId:      z.string().min(1),
  correlationId: z.string().min(1),                          // UUID para trazar un flujo completo
  actorId:       z.string().min(1).optional(),               // userId o agentId que originó el evento
  actorType:     z.enum(["user", "system", "agent"]).default("user"),
  occurredAt:    z.string().datetime(),                      // ISO 8601
  version:       z.literal(1).default(1),
});

export type EventMeta = z.infer<typeof eventMetaSchema>;

// Agentes que pueden reaccionar a eventos
export const agentTriggerSchema = z.array(
  z.enum([
    "pricing",
    "risk",
    "evidence-coach",
    "dispute",
    "trust-match",
    "job-planner",
    "orchestrator",
    "notification",
    "audit",
  ])
);

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FACTORY
// ─────────────────────────────────────────────────────────────────────────────

function domainEvent<TType extends string, TPayload extends z.ZodTypeAny>(
  type: TType,
  payloadSchema: TPayload,
  defaultTriggers: z.infer<typeof agentTriggerSchema> = []
) {
  return z.object({
    type:     z.literal(type),
    meta:     eventMetaSchema,
    payload:  payloadSchema,
    triggers: agentTriggerSchema.default(defaultTriggers),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// JOB EVENTS
// ─────────────────────────────────────────────────────────────────────────────

export const jobCreatedEventSchema = domainEvent(
  "job.created",
  z.object({
    jobId:       z.string(),
    clientOrgId: z.string(),
    title:       z.string(),
    category:    z.string().optional(),
    scope:       z.string(),
    budgetMin:   z.number().optional(),
    budgetMax:   z.number().optional(),
    urgency:     z.enum(["low", "medium", "high", "urgent"]).optional(),
    location:    z.string().optional(),
  }),
  ["pricing", "risk", "audit"]
);

export const jobPostedEventSchema = domainEvent(
  "job.posted",
  z.object({
    jobId:      z.string(),
    clientOrgId: z.string(),
    title:      z.string(),
    category:   z.string().optional(),
    budgetMin:  z.number().optional(),
    budgetMax:  z.number().optional(),
    urgency:    z.enum(["low", "medium", "high", "urgent"]).optional(),
    location:   z.string().optional(),
    pricingSuggestion: z.object({
      estimatedMin: z.number(),
      estimatedMax: z.number(),
      confidence:   z.number(),
    }).optional(),
  }),
  ["trust-match", "notification", "audit"]
);

export const jobPreferredProfessionalSelectedEventSchema = domainEvent(
  "job.preferred_professional_selected",
  z.object({
    jobId: z.string(),
    preferredProfessionalUserId: z.string(),
    preferredProfessionalDisplayName: z.string(),
    preferredProfessionalPublicSlug: z.string().nullable().optional(),
  }),
  ["trust-match", "audit"]
);

export const jobReservedEventSchema = domainEvent(
  "job.reserved",
  z.object({
    jobId:            z.string(),
    reservationId:    z.string(),
    professionalId:   z.string(),
    professionalOrgId: z.string().optional(),
    expiresAt:        z.string().datetime(),
  }),
  ["notification", "audit"]
);

export const jobAssignedEventSchema = domainEvent(
  "job.assigned",
  z.object({
    jobId:            z.string(),
    contractId:       z.string(),
    clientOrgId:      z.string(),
    clientUserId:     z.string(),
    professionalOrgId: z.string().optional(),
    professionalUserId: z.string(),
    agreedAmount:     z.number(),
    scopeSnapshot:    z.record(z.unknown()),            // snapshot inmutable del scope
  }),
  ["job-planner", "risk", "notification", "audit"]
);

export const jobStartedEventSchema = domainEvent(
  "job.started",
  z.object({
    jobId:      z.string(),
    projectId:  z.string(),
    startAt:    z.string().datetime(),
    dueAt:      z.string().datetime().optional(),
  }),
  ["notification", "audit"]
);

export const jobCompletedEventSchema = domainEvent(
  "job.completed",
  z.object({
    jobId:             z.string(),
    projectId:         z.string(),
    clientUserId:      z.string(),
    professionalUserId: z.string(),
    totalPaid:         z.number(),
    milestonesCount:   z.number().int(),
  }),
  ["trust-match", "notification", "audit"]
);

export const jobDisputedEventSchema = domainEvent(
  "job.disputed",
  z.object({
    jobId:       z.string(),
    projectId:   z.string(),
    disputeId:   z.string(),
    raisedById:  z.string(),
    reasonCode:  z.string(),
    milestoneId: z.string().optional(),
  }),
  ["dispute", "risk", "notification", "audit"]
);

export const jobCancelledEventSchema = domainEvent(
  "job.cancelled",
  z.object({
    jobId:       z.string(),
    reason:      z.string(),
    cancelledBy: z.string(),               // userId
    refundAmount: z.number().optional(),
  }),
  ["risk", "notification", "audit"]
);

// ─────────────────────────────────────────────────────────────────────────────
// MILESTONE EVENTS
// ─────────────────────────────────────────────────────────────────────────────

export const milestoneCreatedEventSchema = domainEvent(
  "milestone.created",
  z.object({
    milestoneId: z.string(),
    projectId:   z.string(),
    jobId:       z.string(),
    sequence:    z.number().int(),
    title:       z.string(),
    amount:      z.number(),
    requiredEvidenceTypes: z.array(z.string()),
  }),
  ["notification", "audit"]
);

export const milestoneSubmittedEventSchema = domainEvent(
  "milestone.submitted",
  z.object({
    milestoneId:    z.string(),
    projectId:      z.string(),
    jobId:          z.string(),
    professionalId: z.string(),
    evidenceCount:  z.number().int(),
    checklistComplete: z.boolean(),
    submittedAt:    z.string().datetime(),
  }),
  ["evidence-coach", "notification", "audit"]
);

export const milestoneApprovedEventSchema = domainEvent(
  "milestone.approved",
  z.object({
    milestoneId:    z.string(),
    projectId:      z.string(),
    jobId:          z.string(),
    reviewerId:     z.string(),
    amount:         z.number(),
    isLastMilestone: z.boolean(),
  }),
  ["notification", "audit"]
);

export const milestoneRejectedEventSchema = domainEvent(
  "milestone.rejected",
  z.object({
    milestoneId:    z.string(),
    projectId:      z.string(),
    jobId:          z.string(),
    reviewerId:     z.string(),
    rejectionReason: z.string(),
    correctionNotes: z.string().optional(),
  }),
  ["risk", "notification", "audit"]
);

export const milestoneRevisionRequestedEventSchema = domainEvent(
  "milestone.revision_requested",
  z.object({
    milestoneId:    z.string(),
    requestedById:  z.string(),
    instructions:   z.string(),
  }),
  ["notification", "audit"]
);

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE EVENTS
// ─────────────────────────────────────────────────────────────────────────────

export const evidenceUploadedEventSchema = domainEvent(
  "evidence.uploaded",
  z.object({
    evidenceId:  z.string(),
    projectId:   z.string(),
    milestoneId: z.string().optional(),
    uploaderId:  z.string(),
    kind:        z.enum(["PHOTO", "VIDEO", "DOCUMENT"]),
    bucketKey:   z.string(),
    geoLat:      z.number().optional(),
    geoLng:      z.number().optional(),
  }),
  ["evidence-coach", "audit"]
);

export const evidenceValidatedEventSchema = domainEvent(
  "evidence.validated",
  z.object({
    evidenceId:      z.string(),
    milestoneId:     z.string().optional(),
    validationStatus: z.enum(["passed", "failed", "manual_review"]),
    aiQualityScore:  z.number().min(0).max(1),
    agentId:         z.string(),
    issues:          z.array(z.string()).optional(),
  }),
  ["notification", "audit"]
);

export const evidenceRejectedEventSchema = domainEvent(
  "evidence.rejected",
  z.object({
    evidenceId:   z.string(),
    milestoneId:  z.string().optional(),
    rejectedById: z.string(),
    reason:       z.string(),
  }),
  ["notification", "audit"]
);

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT EVENTS
// ─────────────────────────────────────────────────────────────────────────────

export const paymentFundedEventSchema = domainEvent(
  "payment.funded",
  z.object({
    escrowId:    z.string(),
    jobId:       z.string(),
    contractId:  z.string().optional(),
    amount:      z.number(),
    currency:    z.string().default("USD"),
    providerRef: z.string(),
  }),
  ["notification", "audit"]
);

export const paymentReleasedEventSchema = domainEvent(
  "payment.released",
  z.object({
    txnId:          z.string(),
    escrowId:       z.string(),
    milestoneId:    z.string().optional(),
    jobId:          z.string(),
    payeeId:        z.string(),               // professionalUserId
    grossAmount:    z.number(),
    feeAmount:      z.number(),
    netAmount:      z.number(),
    providerRef:    z.string(),
    releaseReason:  z.string(),               // milestone_approved | job_completed | dispute_resolved
  }),
  ["trust-match", "notification", "audit"]
);

export const paymentHeldEventSchema = domainEvent(
  "payment.held",
  z.object({
    escrowId:    z.string(),
    jobId:       z.string(),
    reason:      z.string(),                  // dispute_opened | compliance_hold | fraud_review
    heldAmount:  z.number(),
  }),
  ["risk", "notification", "audit"]
);

export const paymentFailedEventSchema = domainEvent(
  "payment.failed",
  z.object({
    txnId:       z.string(),
    escrowId:    z.string(),
    jobId:       z.string(),
    amount:      z.number(),
    errorCode:   z.string(),
    providerRef: z.string(),
  }),
  ["risk", "notification", "audit"]
);

export const paymentRefundedEventSchema = domainEvent(
  "payment.refunded",
  z.object({
    txnId:       z.string(),
    escrowId:    z.string(),
    jobId:       z.string(),
    amount:      z.number(),
    refundedTo:  z.string(),                  // userId
    reason:      z.string(),
    providerRef: z.string(),
  }),
  ["notification", "audit"]
);

// ─────────────────────────────────────────────────────────────────────────────
// DISPUTE EVENTS
// ─────────────────────────────────────────────────────────────────────────────

export const disputeOpenedEventSchema = domainEvent(
  "dispute.opened",
  z.object({
    disputeId:   z.string(),
    jobId:       z.string(),
    projectId:   z.string(),
    milestoneId: z.string().optional(),
    raisedById:  z.string(),
    reasonCode:  z.string(),
    reason:      z.string(),
    frozenAmount: z.number().optional(),
  }),
  ["dispute", "risk", "notification", "audit"]
);

export const disputeAssignedEventSchema = domainEvent(
  "dispute.assigned",
  z.object({
    disputeId:  z.string(),
    assigneeId: z.string(),
    jobId:      z.string(),
    severity:   z.enum(["low", "medium", "high", "critical"]),
  }),
  ["notification", "audit"]
);

export const disputeResolvedEventSchema = domainEvent(
  "dispute.resolved",
  z.object({
    disputeId:      z.string(),
    jobId:          z.string(),
    resolvedById:   z.string(),
    resolutionType: z.enum([
      "client_favor",
      "pro_favor",
      "partial_50_50",
      "escalated_legal",
    ]),
    resolution:     z.string(),
    refundAmount:   z.number().optional(),
    releaseAmount:  z.number().optional(),
  }),
  ["trust-match", "risk", "notification", "audit"]
);

export const disputeEscalatedEventSchema = domainEvent(
  "dispute.escalated",
  z.object({
    disputeId:   z.string(),
    escalatedBy: z.string(),
    reason:      z.string(),
  }),
  ["notification", "audit"]
);

// ─────────────────────────────────────────────────────────────────────────────
// RATING EVENTS
// ─────────────────────────────────────────────────────────────────────────────

export const ratingSubmittedEventSchema = domainEvent(
  "rating.submitted",
  z.object({
    ratingId:   z.string(),
    jobId:      z.string(),
    fromUserId: z.string(),
    toUserId:   z.string(),
    score:      z.number().int().min(1).max(5),
    comment:    z.string().optional(),
  }),
  ["trust-match", "audit"]
);

// ─────────────────────────────────────────────────────────────────────────────
// RISK EVENTS
// ─────────────────────────────────────────────────────────────────────────────

export const riskRecalculatedEventSchema = domainEvent(
  "risk.recalculated",
  z.object({
    subjectType:  z.enum(["user", "job", "project", "org"]),
    subjectId:    z.string(),
    previousScore: z.number().optional(),
    newScore:     z.number(),
    newLevel:     z.enum(["low", "medium", "high", "critical"]),
    triggeredBy:  z.string(),                // event type that caused recalculation
    factors:      z.record(z.number()),      // { fraud_risk: 0.1, delay_risk: 0.3, ... }
    modelVersion: z.string(),
  }),
  ["notification", "audit"]
);

export const riskFlagRaisedEventSchema = domainEvent(
  "risk.flag_raised",
  z.object({
    subjectType: z.enum(["user", "job", "project"]),
    subjectId:   z.string(),
    flagCode:    z.string(),                  // fraud_suspect | quality_failure | repeat_dispute
    severity:    z.enum(["low", "medium", "high", "critical"]),
    source:      z.string(),                  // agent name or system
  }),
  ["notification", "audit"]
);

// ─────────────────────────────────────────────────────────────────────────────
// AGENT EVENTS
// ─────────────────────────────────────────────────────────────────────────────

export const agentActionLoggedEventSchema = domainEvent(
  "agent.action_logged",
  z.object({
    agentRunId:         z.string(),
    agentType:          z.string(),
    actionType:         z.enum([
      "classify",
      "recommend",
      "validate",
      "alert",
      "auto_resolve",
      "escalate",
      "generate",
    ]),
    targetType:         z.string(),           // job | milestone | evidence | dispute | user
    targetId:           z.string(),
    inputSummary:       z.string(),
    outputSummary:      z.string(),
    confidence:         z.number().min(0).max(1),
    requiresHumanReview: z.boolean(),
  }),
  ["audit"]
);

export const agentHumanReviewRequestedEventSchema = domainEvent(
  "agent.human_review_requested",
  z.object({
    agentRunId:   z.string(),
    agentType:    z.string(),
    targetType:   z.string(),
    targetId:     z.string(),
    reason:       z.string(),
    urgency:      z.enum(["low", "medium", "high"]),
  }),
  ["notification", "audit"]
);

// ─────────────────────────────────────────────────────────────────────────────
// USER / IDENTITY EVENTS
// ─────────────────────────────────────────────────────────────────────────────

export const userVerifiedEventSchema = domainEvent(
  "user.verified",
  z.object({
    userId:             z.string(),
    verificationType:   z.enum(["email", "phone", "id_document", "background_check"]),
    verifiedAt:         z.string().datetime(),
  }),
  ["trust-match", "notification", "audit"]
);

export const userFlaggedEventSchema = domainEvent(
  "user.flagged",
  z.object({
    userId:      z.string(),
    flagCode:    z.string(),
    reason:      z.string(),
    flaggedById: z.string(),
  }),
  ["risk", "notification", "audit"]
);

export const userTrustScoreUpdatedEventSchema = domainEvent(
  "user.trust_score_updated",
  z.object({
    userId:        z.string(),
    previousScore: z.number(),
    newScore:      z.number(),
    delta:         z.number(),
    reason:        z.string(),               // rating_received | dispute_resolved | job_completed
  }),
  ["audit"]
);

// ─────────────────────────────────────────────────────────────────────────────
// POLICY EVENTS
// ─────────────────────────────────────────────────────────────────────────────

export const policyTriggeredEventSchema = domainEvent(
  "policy.triggered",
  z.object({
    policyRuleId: z.string(),
    policyKey:    z.string(),
    action:       z.enum(["ALLOW", "BLOCK", "REQUIRE", "NOTIFY", "ESCALATE", "AUTO_RESOLVE"]),
    entityType:   z.string(),
    entityId:     z.string(),
    context:      z.record(z.unknown()),
  }),
  ["audit"]
);

// ─────────────────────────────────────────────────────────────────────────────
// DISCRIMINATED UNION — todos los eventos del sistema
// ─────────────────────────────────────────────────────────────────────────────

export const semseEventSchema = z.discriminatedUnion("type", [
  // Job
  jobCreatedEventSchema,
  jobPostedEventSchema,
  jobPreferredProfessionalSelectedEventSchema,
  jobReservedEventSchema,
  jobAssignedEventSchema,
  jobStartedEventSchema,
  jobCompletedEventSchema,
  jobDisputedEventSchema,
  jobCancelledEventSchema,
  // Milestone
  milestoneCreatedEventSchema,
  milestoneSubmittedEventSchema,
  milestoneApprovedEventSchema,
  milestoneRejectedEventSchema,
  milestoneRevisionRequestedEventSchema,
  // Evidence
  evidenceUploadedEventSchema,
  evidenceValidatedEventSchema,
  evidenceRejectedEventSchema,
  // Payment
  paymentFundedEventSchema,
  paymentReleasedEventSchema,
  paymentHeldEventSchema,
  paymentFailedEventSchema,
  paymentRefundedEventSchema,
  // Dispute
  disputeOpenedEventSchema,
  disputeAssignedEventSchema,
  disputeResolvedEventSchema,
  disputeEscalatedEventSchema,
  // Rating
  ratingSubmittedEventSchema,
  // Risk
  riskRecalculatedEventSchema,
  riskFlagRaisedEventSchema,
  // Agent
  agentActionLoggedEventSchema,
  agentHumanReviewRequestedEventSchema,
  // User
  userVerifiedEventSchema,
  userFlaggedEventSchema,
  userTrustScoreUpdatedEventSchema,
  // Policy
  policyTriggeredEventSchema,
]);

export type SemseEvent = z.infer<typeof semseEventSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// TIPO DE EVENTO (enum de conveniencia)
// ─────────────────────────────────────────────────────────────────────────────

export const SEMSE_EVENT_TYPES = [
  "job.created",
  "job.posted",
  "job.preferred_professional_selected",
  "job.reserved",
  "job.assigned",
  "job.started",
  "job.completed",
  "job.disputed",
  "job.cancelled",
  "milestone.created",
  "milestone.submitted",
  "milestone.approved",
  "milestone.rejected",
  "milestone.revision_requested",
  "evidence.uploaded",
  "evidence.validated",
  "evidence.rejected",
  "payment.funded",
  "payment.released",
  "payment.held",
  "payment.failed",
  "payment.refunded",
  "dispute.opened",
  "dispute.assigned",
  "dispute.resolved",
  "dispute.escalated",
  "rating.submitted",
  "risk.recalculated",
  "risk.flag_raised",
  "agent.action_logged",
  "agent.human_review_requested",
  "user.verified",
  "user.flagged",
  "user.trust_score_updated",
  "policy.triggered",
] as const;

export type SemseEventType = typeof SEMSE_EVENT_TYPES[number];

// ─────────────────────────────────────────────────────────────────────────────
// MAPA: evento → agentes que deben reaccionar (para el event router)
// ─────────────────────────────────────────────────────────────────────────────

export const EVENT_AGENT_MAP: Record<SemseEventType, string[]> = {
  "job.created":                    ["pricing", "risk", "audit"],
  "job.posted":                     ["trust-match", "notification", "audit"],
  "job.preferred_professional_selected": ["trust-match", "audit"],
  "job.reserved":                   ["notification", "audit"],
  "job.assigned":                   ["job-planner", "risk", "notification", "audit"],
  "job.started":                    ["notification", "audit"],
  "job.completed":                  ["trust-match", "notification", "audit"],
  "job.disputed":                   ["dispute", "risk", "notification", "audit"],
  "job.cancelled":                  ["risk", "notification", "audit"],
  "milestone.created":              ["notification", "audit"],
  "milestone.submitted":            ["evidence-coach", "notification", "audit"],
  "milestone.approved":             ["notification", "audit"],
  "milestone.rejected":             ["risk", "notification", "audit"],
  "milestone.revision_requested":   ["notification", "audit"],
  "evidence.uploaded":              ["evidence-coach", "audit"],
  "evidence.validated":             ["notification", "audit"],
  "evidence.rejected":              ["notification", "audit"],
  "payment.funded":                 ["notification", "audit"],
  "payment.released":               ["trust-match", "notification", "audit"],
  "payment.held":                   ["risk", "notification", "audit"],
  "payment.failed":                 ["risk", "notification", "audit"],
  "payment.refunded":               ["notification", "audit"],
  "dispute.opened":                 ["dispute", "risk", "notification", "audit"],
  "dispute.assigned":               ["notification", "audit"],
  "dispute.resolved":               ["trust-match", "risk", "notification", "audit"],
  "dispute.escalated":              ["notification", "audit"],
  "rating.submitted":               ["trust-match", "audit"],
  "risk.recalculated":              ["notification", "audit"],
  "risk.flag_raised":               ["notification", "audit"],
  "agent.action_logged":            ["audit"],
  "agent.human_review_requested":   ["notification", "audit"],
  "user.verified":                  ["trust-match", "notification", "audit"],
  "user.flagged":                   ["risk", "notification", "audit"],
  "user.trust_score_updated":       ["audit"],
  "policy.triggered":               ["audit"],
};
