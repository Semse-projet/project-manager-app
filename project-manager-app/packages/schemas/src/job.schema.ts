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
  urgency: z.string().min(1).optional(),
  deadline: z.string().min(1).optional(),
  preferredProfessional: preferredProfessionalSchema.optional(),
});

export const bidSchema = z.object({
  jobId: z.string().min(1),
  proOrgId: z.string().min(1),
  amount: z.number().positive(),
  etaDays: z.number().int().positive()
});

export type JobRecordStatus = z.infer<typeof jobRecordStatusSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type CreateRuntimeJobInput = z.infer<typeof createRuntimeJobSchema>;
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
export type JobRecordView = z.infer<typeof jobRecordSchema>;
export type PreferredProfessionalView = z.infer<typeof preferredProfessionalSchema>;
export type BidInput = z.infer<typeof bidSchema>;
