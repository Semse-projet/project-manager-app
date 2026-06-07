import { z } from "zod";

export const createProjectDisputeSchema = z.object({
  projectId: z.string().min(1),
  reason: z.string().min(5).max(1000)
});

export const createDisputeSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    jobId: z.string().min(1).optional(),
    reason: z.string().min(5).max(1000)
  })
  .refine((input) => Boolean(input.projectId || input.jobId), {
    message: "projectId or jobId is required",
    path: ["jobId"]
  });

export const assignDisputeSchema = z.object({
  assigneeUserId: z.string().min(1)
});

export const resolveProjectDisputeSchema = z.object({
  resolution: z.string().min(1),
  resolutionType: z
    .enum(["client_favor", "pro_favor", "partial_50_50", "escalated_legal"])
    .optional()
});

export const submitDisputeEvidenceSchema = z.object({
  evidenceIds: z.array(z.string().min(1)).min(1).max(50)
});

export const disputeReasonCodeSchema = z.enum([
  "incomplete_work",
  "quality_issue",
  "no_show",
  "payment_dispute",
  "other"
]);

export type CreateProjectDisputeInput = z.infer<typeof createProjectDisputeSchema>;
export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;
export type AssignDisputeInput = z.infer<typeof assignDisputeSchema>;
export type ResolveProjectDisputeInput = z.infer<typeof resolveProjectDisputeSchema>;
export type SubmitDisputeEvidenceInput = z.infer<typeof submitDisputeEvidenceSchema>;
export type DisputeReasonCode = z.infer<typeof disputeReasonCodeSchema>;
