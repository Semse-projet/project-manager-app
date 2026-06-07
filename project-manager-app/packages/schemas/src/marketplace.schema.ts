import { z } from "zod";

export const visibleJobStateSchema = z.enum([
  "DRAFT",
  "POSTED",
  "RESERVED",
  "ACCEPTED",
  "IN_PROGRESS",
  "REVIEW",
  "DISPUTE",
  "COMPLETED",
  "CANCELLED"
]);

export const legacyJobStateSchema = z.enum(["PUBLISHED", "AWARDED"]);

export const jobStateSchema = z.enum([
  "DRAFT",
  "POSTED",
  "PUBLISHED",
  "RESERVED",
  "ACCEPTED",
  "IN_PROGRESS",
  "REVIEW",
  "DISPUTE",
  "COMPLETED",
  "AWARDED",
  "CANCELLED"
]);

export const reservationStateSchema = z.enum([
  "ACTIVE",
  "EXPIRED",
  "ACCEPTED",
  "RELEASED"
]);

export const milestoneStateSchema = z.enum([
  "DRAFT",
  "AWAITING_REVIEW",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "PAID"
]);

export const evidenceKindSchema = z.enum(["PHOTO", "VIDEO", "DOCUMENT"]);

export const reviewDecisionSchema = z.enum([
  "APPROVE",
  "REJECT",
  "REQUEST_CHANGES",
  "ESCALATE_DISPUTE"
]);

export const visibleEscrowTransactionTypeSchema = z.enum([
  "FUND",
  "RELEASE",
  "HOLDBACK",
  "FEE",
  "REFUND"
]);

export const escrowTransactionTypeSchema = z.enum([
  "DEPOSIT",
  "RELEASE",
  "HOLDBACK",
  "FEE",
  "REFUND"
]);

export const disputeStateSchema = z.enum([
  "OPEN",
  "ASSIGNED",
  "UNDER_REVIEW",
  "RESOLVED",
  "REJECTED"
]);

export const budgetTypeSchema = z.enum(["FIXED", "TIME_AND_MATERIALS"]);

export const createMarketplaceJobSchema = z
  .object({
    clientOrgId: z.string().min(1),
    clientUserId: z.string().min(1).optional(),
    title: z.string().min(5).max(140),
    category: z.string().min(2).max(80),
    scope: z.string().min(10).max(5000),
    location: z.string().min(2).max(240),
    budgetType: budgetTypeSchema,
    budgetMin: z.number().int().nonnegative().optional(),
    budgetMax: z.number().int().nonnegative().optional()
  })
  .refine(
    (input) =>
      input.budgetMin === undefined ||
      input.budgetMax === undefined ||
      input.budgetMin <= input.budgetMax,
    {
      message: "budgetMin must be less than or equal to budgetMax",
      path: ["budgetMax"]
    }
  );

export const reserveJobSchema = z.object({
  jobId: z.string().min(1),
  expiresInMinutes: z.number().int().positive().max(24 * 60)
});

export const reservationRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  jobId: z.string().min(1),
  professionalId: z.string().min(1),
  professionalOrgId: z.string().min(1).optional(),
  status: z.enum(["active", "expired", "accepted", "released"]),
  reservedAt: z.string().min(1),
  expiresAt: z.string().min(1),
  releasedAt: z.string().min(1).optional(),
  acceptedAt: z.string().min(1).optional()
});

export const acceptJobSchema = z.object({
  jobId: z.string().min(1),
  professionalOrgId: z.string().min(1),
  acceptedByUserId: z.string().min(1).optional(),
  reservationId: z.string().min(1).optional()
});

export const generateContractSchema = z.object({
  jobId: z.string().min(1),
  termsJson: z.record(z.string(), z.unknown())
});

export const contractRecordSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  clientOrgId: z.string().min(1),
  professionalOrgId: z.string().min(1),
  signedClientAt: z.string().min(1).nullable().optional(),
  signedProAt: z.string().min(1).nullable().optional(),
  documentHash: z.string().min(1).nullable().optional(),
  pdfUrl: z.string().url().nullable().optional(),
  termsJson: z.record(z.string(), z.unknown())
});

export const signContractSchema = z.object({
  contractId: z.string().min(1),
  signAs: z.enum(["client", "professional"]).optional(),
  documentHash: z.string().min(16),
  pdfUrl: z.string().url().optional()
});

export const createMilestoneSchema = z.object({
  jobId: z.string().min(1),
  idx: z.number().int().positive(),
  title: z.string().min(3).max(140),
  amountCents: z.number().int().positive()
});

export const uploadEvidenceSchema = z.object({
  milestoneId: z.string().min(1),
  uploadedBy: z.string().min(1),
  kind: evidenceKindSchema,
  storageUrl: z.string().min(3).max(2048),
  description: z.string().min(3).max(2000).optional(),
  metadataJson: z.record(z.string(), z.unknown()).optional()
});

export const reviewMilestoneSchema = z.object({
  milestoneId: z.string().min(1),
  reviewerId: z.string().min(1),
  decision: reviewDecisionSchema,
  comment: z.string().min(3).max(2000).optional()
});

export const fundEscrowSchema = z.object({
  jobId: z.string().min(1),
  provider: z.string().min(2).max(64),
  amountCents: z.number().int().positive(),
  providerRef: z.string().min(3).max(128)
});

export const releaseMilestonePaymentSchema = z.object({
  milestoneId: z.string().min(1),
  providerRef: z.string().min(3).max(128).optional(),
  amountCents: z.number().int().positive().optional()
});

export const openDisputeSchema = z.object({
  jobId: z.string().min(1),
  milestoneId: z.string().min(1).optional(),
  openedById: z.string().min(1),
  reason: z.string().min(10).max(3000)
});

export const resolveDisputeSchema = z.object({
  disputeId: z.string().min(1),
  resolvedById: z.string().min(1),
  resolution: z.string().min(10).max(3000)
});

export const createRatingSchema = z.object({
  jobId: z.string().min(1),
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  score: z.number().int().min(1).max(5),
  comment: z.string().min(3).max(1000).optional()
});

export type VisibleJobState = z.infer<typeof visibleJobStateSchema>;
export type LegacyJobState = z.infer<typeof legacyJobStateSchema>;
export type JobState = z.infer<typeof jobStateSchema>;
export type ReservationState = z.infer<typeof reservationStateSchema>;
export type MilestoneState = z.infer<typeof milestoneStateSchema>;
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type VisibleEscrowTransactionType = z.infer<typeof visibleEscrowTransactionTypeSchema>;
export type EscrowTransactionType = z.infer<typeof escrowTransactionTypeSchema>;
export type DisputeState = z.infer<typeof disputeStateSchema>;
export type BudgetType = z.infer<typeof budgetTypeSchema>;
export type CreateMarketplaceJobInput = z.infer<typeof createMarketplaceJobSchema>;
export type ReserveJobInput = z.infer<typeof reserveJobSchema>;
export type ReservationRecord = z.infer<typeof reservationRecordSchema>;
export type AcceptJobInput = z.infer<typeof acceptJobSchema>;
export type GenerateContractInput = z.infer<typeof generateContractSchema>;
export type ContractRecord = z.infer<typeof contractRecordSchema>;
export type SignContractInput = z.infer<typeof signContractSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UploadEvidenceInput = z.infer<typeof uploadEvidenceSchema>;
export type ReviewMilestoneInput = z.infer<typeof reviewMilestoneSchema>;
export type FundEscrowInput = z.infer<typeof fundEscrowSchema>;
export type ReleaseMilestonePaymentInput = z.infer<typeof releaseMilestonePaymentSchema>;
export type OpenDisputeInput = z.infer<typeof openDisputeSchema>;
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
export type CreateRatingInput = z.infer<typeof createRatingSchema>;
