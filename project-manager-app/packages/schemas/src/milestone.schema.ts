import { z } from "zod";

// Named MilestoneRecordStatus (not MilestoneStatus) to avoid colliding with
// the pre-existing, differently-valued MilestoneStatus in client.types.ts
// (a legacy UI-only type using "pending" instead of "draft"/"awaiting_review").
export const milestoneRecordStatusSchema = z.enum([
  "draft",
  "awaiting_review",
  "submitted",
  "approved",
  "rejected",
  "paid",
]);

// Matches MilestoneRecord in apps/api/src/common/domain-store.ts — the shape
// returned by GET /v1/jobs/:jobId/milestones and GET /v1/projects/:projectId/milestones.
export const milestoneRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  amount: z.number(),
  sequence: z.number(),
  status: milestoneRecordStatusSchema,
  rejectionReason: z.string().optional(),
  reviewDecision: z.enum(["approve", "reject", "request_changes"]).optional(),
  evidenceCount: z.number().optional(),
});

export type MilestoneRecordStatus = z.infer<typeof milestoneRecordStatusSchema>;
export type MilestoneRecordView = z.infer<typeof milestoneRecordSchema>;

/**
 * GET /v1/jobs/:jobId/milestones runs through toVisibleMilestone() server-side
 * (apps/api/src/common/visible-response.ts), which uppercases `status` (e.g.
 * "submitted" -> "SUBMITTED") for display. Same pattern/reason as
 * normalizeJobRecordStatus in job.schema.ts — apply at any boundary that
 * forwards a milestone record to a client expecting the lowercase enum this
 * schema declares.
 */
export function normalizeMilestoneRecordStatus<T extends { status?: unknown }>(record: T): T {
  if (typeof record?.status !== "string") return record;
  return { ...record, status: record.status.toLowerCase() };
}
