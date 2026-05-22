import { z } from "zod";

export const projectStatusSchema = z.enum(["open", "in_progress", "blocked", "completed", "cancelled"]);

export const projectSummarySchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  jobId: z.string().min(1),
  assignedProOrgId: z.string().min(1),
  status: projectStatusSchema
});

export const projectEscrowSummarySchema = z.object({
  escrow: z
    .object({
      id: z.string().min(1),
      tenantId: z.string().min(1),
      projectId: z.string().min(1),
      jobId: z.string().min(1).optional(),
      contractId: z.string().min(1).optional(),
      status: z.enum(["active", "closed"]),
      totalAmount: z.number().nonnegative(),
      currency: z.string().min(1)
    })
    .nullable(),
  totalDeposited: z.number().nonnegative(),
  totalReleased: z.number().nonnegative(),
  totalRefunded: z.number().nonnegative(),
  available: z.number()
});

export const updateProjectStatusSchema = z.object({
  status: projectStatusSchema
});

export const listProjectsQuerySchema = z.object({
  status: projectStatusSchema.optional(),
  jobId: z.string().min(1).optional()
});

export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ProjectEscrowSummary = z.infer<typeof projectEscrowSummarySchema>;
export type UpdateProjectStatus = z.infer<typeof updateProjectStatusSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
