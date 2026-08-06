import { z } from "zod";

export const jobRecordStatusSchema = z.enum([
  "draft",
  "posted",
  "published",
  "reserved",
  "accepted",
  "in_progress",
  "review",
  "dispute",
  "completed",
  "awarded",
  "cancelled"
]);

export const createJobSchema = z.object({
  tenantId: z.string().min(1).optional(),
  clientOrgId: z.string().min(1).optional(),
  title: z.string().min(5).max(140),
  category: z.string().min(2).max(80).optional(),
  scope: z.string().min(10).max(5000),
  location: z.string().min(2).max(240).optional(),
  budgetType: z.enum(["FIXED", "TIME_AND_MATERIALS"]).optional(),
  budgetMin: z.number().nonnegative().optional(),
  budgetMax: z.number().nonnegative().optional()
});

export const preferredProfessionalSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1).max(160),
  publicSlug: z.string().min(1).max(240).optional(),
});

export const createRuntimeJobSchema = z.object({
  title: z.string().min(5).max(140),
  scope: z.string().min(10).max(5000),
  category: z.string().min(2).max(80).optional(),
  budgetType: z.enum(["fixed", "range", "hourly"]).optional(),
  budgetMin: z.number().nonnegative().optional(),
  budgetMax: z.number().nonnegative().optional(),
  locationType: z.enum(["remote", "on_site", "hybrid"]).optional(),
  city: z.string().min(2).max(240).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  urgency: z.enum(["low", "medium", "high", "urgent"]).optional(),
  deadline: z.string().min(8).max(40).optional(),
  preferredProfessional: preferredProfessionalSchema.optional(),
});

export const listJobsQuerySchema = z.object({
  status: jobRecordStatusSchema.optional()
});

export const jobRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1).optional(),
  scope: z.string().min(1),
  status: jobRecordStatusSchema,
  budgetType: z.string().min(1).optional(),
  budgetMin: z.number().nonnegative().optional(),
  budgetMax: z.number().nonnegative().optional(),
  location: z.string().min(1).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  locationSource: z.enum(["geocoded", "manual"]).optional(),
  urgency: z.string().min(1).optional(),
  deadline: z.string().min(1).optional(),
  preferredProfessional: preferredProfessionalSchema.optional(),
  // Populated only where the source query resolves it (currently
  // bids.repository.ts listByWorker, via Contract.clientUserId — Job
  // itself only has clientOrgId, not a specific user). See
  // G-PRO-07/2.17 in docs/AUDIT_REMEDIATION_PLAN.md.
  clientUserId: z.string().min(1).optional(),
  clientEmail: z.string().min(1).optional(),
});

export const bidSchema = z.object({
  jobId: z.string().min(1),
  proOrgId: z.string().min(1),
  amount: z.number().positive(),
  etaDays: z.number().int().positive(),
  note: z.string().max(1000).optional(),
});

// Matches BidRecord in apps/api/src/common/domain-store.ts — the shape
// returned by GET /v1/my-bids, GET /v1/jobs/:jobId/bids and
// POST /v1/jobs/:jobId/bids.
export const bidRecordSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  tenantId: z.string().min(1),
  proOrgId: z.string().min(1),
  professionalUserId: z.string().min(1).optional(),
  amount: z.number(),
  etaDays: z.number().int(),
  status: z.enum(["submitted", "accepted", "rejected"]),
  proEmail: z.string().min(1).optional(),
  note: z.string().optional(),
  jobTitle: z.string().optional(),
  jobCategory: z.string().optional(),
  jobLocation: z.string().optional(),
  jobBudgetMin: z.number().optional(),
  jobBudgetMax: z.number().optional(),
  jobStatus: z.string().optional(),
  clientUserId: z.string().optional(),
  clientEmail: z.string().optional(),
  createdAt: z.string().optional(),
  avgRating: z.number().optional(),
  ratingCount: z.number().optional(),
});

/**
 * The Prisma `JobStatus` enum is uppercase and NestJS's `toVisibleJob` mapper
 * returns it uppercase too — but `jobRecordStatusSchema` (and every frontend
 * consumer of `JobRecordView`) has always expected lowercase. Apply this at
 * every BFF boundary that forwards a job record from the API to the browser,
 * so `status` actually matches the schema it's typed against.
 */
export function normalizeJobRecordStatus<T extends { status?: unknown }>(record: T): T {
  if (typeof record?.status !== "string") return record;
  return { ...record, status: record.status.toLowerCase() };
}

export type JobRecordStatus = z.infer<typeof jobRecordStatusSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type CreateRuntimeJobInput = z.infer<typeof createRuntimeJobSchema>;
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
export type JobRecordView = z.infer<typeof jobRecordSchema>;
export type PreferredProfessionalView = z.infer<typeof preferredProfessionalSchema>;
export type BidInput = z.infer<typeof bidSchema>;
export type BidRecordView = z.infer<typeof bidRecordSchema>;
