import { z } from "zod";

// SEMSE Knowledge Contributor Program — contracts shared by apps/api's
// contributor-program module and apps/web's BFF routes/UI. Trade-agnostic;
// first seeded mission targets electricians (see docs/specs/core/
// knowledge-contributor-program.spec.md).

export const contributorLocaleSchema = z.enum(["es", "en"]);

// ── Terms & consent ────────────────────────────────────────────────────────

export const contributorTermsVersionViewSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  effectiveAt: z.string().min(1),
  contentEs: z.string().min(1),
  contentEn: z.string().min(1),
  contentHash: z.string().min(1),
  isActive: z.boolean()
});

// The five checkboxes required by the spec before "Aceptar y participar" —
// all must be true, none is preselected client-side.
export const contributorConsentCheckboxesSchema = z.object({
  isAdult: z.literal(true),
  acceptedTerms: z.literal(true),
  authorizedToRecord: z.literal(true),
  understandsSafetyPriority: z.literal(true),
  understandsDataUse: z.literal(true)
});

export const acceptContributorTermsSchema = z.object({
  termsVersionId: z.string().min(1),
  termsContentHash: z.string().min(1),
  locale: contributorLocaleSchema,
  checkboxes: contributorConsentCheckboxesSchema
});

export const contributorConsentViewSchema = z.object({
  id: z.string().min(1),
  termsVersionId: z.string().min(1),
  termsVersion: z.string().min(1),
  locale: contributorLocaleSchema,
  acceptedAt: z.string().min(1)
});

// ── Missions ────────────────────────────────────────────────────────────────

export const knowledgeMissionDifficultySchema = z.enum(["beginner", "intermediate", "advanced"]);

export const knowledgeMissionStatusSchema = z.enum(["DRAFT", "PUBLISHED", "PAUSED", "CLOSED", "ARCHIVED"]);

export const createKnowledgeMissionSchema = z.object({
  title: z.string().min(1).max(200),
  trade: z.string().min(1).max(100),
  category: z.string().min(1).max(100),
  description: z.string().min(1).max(10000),
  difficulty: knowledgeMissionDifficultySchema,
  requirements: z.array(z.string().min(1)).min(1),
  evidenceRequested: z.array(z.string().min(1)).min(1),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  baseCompensationCents: z.number().int().nonnegative(),
  currency: z.string().min(3).max(3).default("USD"),
  bonus: z
    .object({
      description: z.string().min(1),
      amountCents: z.number().int().nonnegative()
    })
    .optional(),
  deadlineAt: z.string().min(1).optional(),
  maxParticipants: z.number().int().positive().optional(),
  isDemo: z.boolean().default(false)
});

export const knowledgeMissionViewSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  trade: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  difficulty: knowledgeMissionDifficultySchema,
  requirements: z.array(z.string()),
  evidenceRequested: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  baseCompensationCents: z.number().int(),
  currency: z.string(),
  bonus: z.object({ description: z.string(), amountCents: z.number().int() }).nullable().optional(),
  deadlineAt: z.string().nullable().optional(),
  maxParticipants: z.number().int().nullable().optional(),
  acceptedCount: z.number().int().optional(),
  status: knowledgeMissionStatusSchema,
  version: z.number().int(),
  isDemo: z.boolean(),
  createdAt: z.string()
});

// ── Mission acceptance ─────────────────────────────────────────────────────

export const knowledgeMissionAcceptanceStatusSchema = z.enum([
  "ACCEPTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "CANCELLED",
  "EXPIRED"
]);

export const knowledgeMissionAcceptanceViewSchema = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  missionTitle: z.string().min(1),
  compensationCentsSnapshot: z.number().int(),
  currencySnapshot: z.string(),
  deadlineAtSnapshot: z.string().nullable().optional(),
  status: knowledgeMissionAcceptanceStatusSchema,
  acceptedAt: z.string()
});

// ── Submissions & assets ───────────────────────────────────────────────────

export const knowledgeSubmissionStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
  "PAYMENT_PENDING",
  "PAID",
  "DISPUTED",
  "CANCELLED"
]);

export const knowledgeAssetKindSchema = z.enum(["VIDEO", "IMAGE", "AUDIO", "TEXT"]);

export const knowledgeAssetClipRoleSchema = z.enum([
  "BEFORE",
  "PLANNING",
  "EXECUTION",
  "PROBLEM_CORRECTION",
  "RESULT",
  "OTHER"
]);

export const createKnowledgeSubmissionSchema = z.object({
  acceptanceId: z.string().min(1)
});

export const knowledgeAssetUploadPlanSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  fileSizeBytes: z.number().int().positive().max(1024 * 1024 * 1024 * 5).optional()
});

export const registerKnowledgeAssetSchema = z
  .object({
    kind: knowledgeAssetKindSchema,
    clipRole: knowledgeAssetClipRoleSchema.default("OTHER"),
    key: z.string().min(1).optional(),
    filename: z.string().min(1).max(300).optional(),
    checksum: z.string().min(1).optional(),
    mimeType: z.string().min(1).optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    textContent: z.string().min(1).max(20000).optional()
  })
  .refine((input) => input.kind === "TEXT" || Boolean(input.key), {
    message: "key is required for non-TEXT assets",
    path: ["key"]
  })
  .refine((input) => input.kind !== "TEXT" || Boolean(input.textContent), {
    message: "textContent is required for TEXT assets",
    path: ["textContent"]
  });

export const knowledgeAssetViewSchema = z.object({
  id: z.string().min(1),
  kind: knowledgeAssetKindSchema,
  clipRole: knowledgeAssetClipRoleSchema,
  filename: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  sizeBytes: z.number().int().nullable().optional(),
  processingStatus: z.enum(["PENDING", "PROCESSING", "PROCESSED", "FAILED"]),
  // PR-7 (docs/specs/core/knowledge-contributor-human-review-workspace.spec.md):
  // null for TEXT assets or any row missing a storageKey — never a broken
  // media element in the UI.
  previewUrl: z.string().nullable().optional(),
  createdAt: z.string()
});

export const submitKnowledgeSubmissionSchema = z.object({
  notes: z.string().max(5000).optional()
});

export const knowledgeSubmissionViewSchema = z.object({
  id: z.string().min(1),
  acceptanceId: z.string().min(1),
  missionId: z.string().min(1),
  missionTitle: z.string().min(1),
  status: knowledgeSubmissionStatusSchema,
  notes: z.string().nullable().optional(),
  assets: z.array(knowledgeAssetViewSchema),
  compensationCentsSnapshot: z.number().int(),
  currencySnapshot: z.string(),
  submittedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  reward: z
    .object({
      status: z.string(),
      amountCents: z.number().int(),
      currency: z.string(),
      paidAt: z.string().nullable().optional()
    })
    .nullable()
    .optional()
});

// ── Review & appeal ─────────────────────────────────────────────────────────

export const knowledgeReviewDecisionSchema = z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]);

export const reviewKnowledgeSubmissionSchema = z.object({
  decision: knowledgeReviewDecisionSchema,
  reason: z.string().min(1).max(5000),
  qualityFlags: z.array(z.string()).optional()
});

export const knowledgeReviewViewSchema = z.object({
  id: z.string().min(1),
  decision: knowledgeReviewDecisionSchema,
  reason: z.string(),
  reviewerUserId: z.string(),
  createdAt: z.string()
});

export const createKnowledgeAppealSchema = z.object({
  reason: z.string().min(1).max(5000)
});

export const knowledgeAppealStatusSchema = z.enum(["OPEN", "UNDER_REVIEW", "UPHELD", "OVERTURNED"]);

export const resolveKnowledgeAppealSchema = z.object({
  status: z.enum(["UPHELD", "OVERTURNED"]),
  resolutionReason: z.string().min(1).max(5000)
});

export const knowledgeAppealViewSchema = z.object({
  id: z.string().min(1),
  reason: z.string(),
  status: knowledgeAppealStatusSchema,
  resolutionReason: z.string().nullable().optional(),
  resolvedAt: z.string().nullable().optional(),
  createdAt: z.string()
});

// ── Extractions / Transcript / Observation (PR-5) ──────────────────────────
// docs/specs/core/knowledge-contributor-transcript-observation.spec.md

export const knowledgeExtractionStatusSchema = z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]);

export const transcriptSegmentViewSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  text: z.string(),
  confidence: z.number().nullable().optional(),
  createdAt: z.string()
});

export const observationPromotionStatusSchema = z.enum(["PENDING", "PROMOTED", "REJECTED"]);

export const observationViewSchema = z.object({
  id: z.string().min(1),
  objective: z.string().nullable().optional(),
  condition: z.string().nullable().optional(),
  decision: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  method: z.string().nullable().optional(),
  action: z.string().nullable().optional(),
  result: z.string().nullable().optional(),
  sourceSegmentIds: z.array(z.string()),
  generatedBy: z.string(),
  isCorrected: z.boolean(),
  correctedFields: z.record(z.string(), z.string()).nullable().optional(),
  correctedByUserId: z.string().nullable().optional(),
  correctedReason: z.string().nullable().optional(),
  correctedAt: z.string().nullable().optional(),
  promotionStatus: observationPromotionStatusSchema,
  promotedByUserId: z.string().nullable().optional(),
  promotedAt: z.string().nullable().optional(),
  promotionReason: z.string().nullable().optional(),
  createdAt: z.string()
});

export const knowledgeExtractionViewSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().nullable().optional(),
  kind: z.string(),
  status: knowledgeExtractionStatusSchema,
  failureReason: z.string().nullable().optional(),
  extractedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  transcriptSegments: z.array(transcriptSegmentViewSchema),
  observations: z.array(observationViewSchema)
});

export const observationFieldNameSchema = z.enum([
  "objective",
  "condition",
  "decision",
  "reason",
  "method",
  "action",
  "result"
]);

export const correctObservationSchema = z.object({
  correctedFields: z
    .record(observationFieldNameSchema, z.string().min(1).max(5000))
    .refine((fields) => Object.keys(fields).length > 0, {
      message: "correctedFields must contain at least one OBSERVATION field"
    }),
  reason: z.string().min(1).max(5000)
});

// PR-6 (docs/specs/core/knowledge-contributor-evidence-promotion.spec.md):
// shared by both the promote and reject-promotion endpoints — an editorial
// decision, always with a reason, never conflict-guarded like correction.
export const setObservationPromotionSchema = z.object({
  reason: z.string().min(1).max(5000)
});

// PR-8 (docs/specs/core/knowledge-contributor-registry.spec.md): a
// registry row is an observationViewSchema plus the mission context it
// belongs to — the registry always crosses submission -> mission, unlike
// the review-panel views which already sit inside one mission's context.
export const knowledgeRegistryEntryViewSchema = observationViewSchema.extend({
  missionId: z.string().min(1),
  missionTitle: z.string(),
  trade: z.string(),
  category: z.string()
});

export const listKnowledgeRegistryQuerySchema = z.object({
  trade: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(200).optional(),
  missionId: z.string().min(1).optional(),
  search: z.string().min(1).max(500).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const knowledgeRegistryPageSchema = z.object({
  items: z.array(knowledgeRegistryEntryViewSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  hasMore: z.boolean()
});

// ── Rewards ──────────────────────────────────────────────────────────────

export const contributorRewardStatusSchema = z.enum([
  "PENDING_REVIEW",
  "APPROVED",
  "PAYMENT_PENDING",
  "PAID",
  "BLOCKED_NO_PAYOUT_ACCOUNT",
  "FAILED",
  "REVERSED"
]);

export const contributorRewardViewSchema = z.object({
  id: z.string().min(1),
  submissionId: z.string().min(1),
  amountCents: z.number().int(),
  currency: z.string(),
  status: contributorRewardStatusSchema,
  paidAt: z.string().nullable().optional(),
  createdAt: z.string()
});

// ── Dashboard ────────────────────────────────────────────────────────────

export const contributorDashboardViewSchema = z.object({
  profile: z.object({ trade: z.string(), status: z.string() }).nullable(),
  hasAcceptedActiveTerms: z.boolean(),
  acceptances: z.array(knowledgeMissionAcceptanceViewSchema),
  submissions: z.array(knowledgeSubmissionViewSchema),
  totalPaidCents: z.number().int(),
  currency: z.string()
});

export type ContributorLocale = z.infer<typeof contributorLocaleSchema>;
export type ContributorTermsVersionView = z.infer<typeof contributorTermsVersionViewSchema>;
export type AcceptContributorTermsInput = z.infer<typeof acceptContributorTermsSchema>;
export type ContributorConsentView = z.infer<typeof contributorConsentViewSchema>;
export type CreateKnowledgeMissionInput = z.infer<typeof createKnowledgeMissionSchema>;
export type KnowledgeMissionView = z.infer<typeof knowledgeMissionViewSchema>;
export type KnowledgeMissionAcceptanceView = z.infer<typeof knowledgeMissionAcceptanceViewSchema>;
export type CreateKnowledgeSubmissionInput = z.infer<typeof createKnowledgeSubmissionSchema>;
export type KnowledgeAssetUploadPlanInput = z.infer<typeof knowledgeAssetUploadPlanSchema>;
export type RegisterKnowledgeAssetInput = z.infer<typeof registerKnowledgeAssetSchema>;
export type KnowledgeAssetView = z.infer<typeof knowledgeAssetViewSchema>;
export type SubmitKnowledgeSubmissionInput = z.infer<typeof submitKnowledgeSubmissionSchema>;
export type KnowledgeSubmissionView = z.infer<typeof knowledgeSubmissionViewSchema>;
export type ReviewKnowledgeSubmissionInput = z.infer<typeof reviewKnowledgeSubmissionSchema>;
export type KnowledgeReviewView = z.infer<typeof knowledgeReviewViewSchema>;
export type CreateKnowledgeAppealInput = z.infer<typeof createKnowledgeAppealSchema>;
export type ResolveKnowledgeAppealInput = z.infer<typeof resolveKnowledgeAppealSchema>;
export type KnowledgeAppealView = z.infer<typeof knowledgeAppealViewSchema>;
export type ContributorRewardView = z.infer<typeof contributorRewardViewSchema>;
export type ContributorDashboardView = z.infer<typeof contributorDashboardViewSchema>;
export type KnowledgeExtractionStatus = z.infer<typeof knowledgeExtractionStatusSchema>;
export type TranscriptSegmentView = z.infer<typeof transcriptSegmentViewSchema>;
export type ObservationPromotionStatus = z.infer<typeof observationPromotionStatusSchema>;
export type ObservationView = z.infer<typeof observationViewSchema>;
export type SetObservationPromotionInput = z.infer<typeof setObservationPromotionSchema>;
export type KnowledgeExtractionView = z.infer<typeof knowledgeExtractionViewSchema>;
export type ObservationFieldName = z.infer<typeof observationFieldNameSchema>;
export type CorrectObservationInput = z.infer<typeof correctObservationSchema>;
export type KnowledgeRegistryEntryView = z.infer<typeof knowledgeRegistryEntryViewSchema>;
export type ListKnowledgeRegistryQuery = z.infer<typeof listKnowledgeRegistryQuerySchema>;
export type KnowledgeRegistryPage = z.infer<typeof knowledgeRegistryPageSchema>;
