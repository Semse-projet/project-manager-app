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

export const projectCommercialStageSchema = z.enum([
  "draft",
  "sourcing",
  "reserved",
  "awarded",
  "contract_pending",
  "contract_signed",
  "closed",
  "cancelled"
]);

const lifecycleBlockerSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low"]),
  message: z.string().min(1),
  owner: z.enum(["client", "professional", "ops", "system"]),
  source: z.enum(["project", "milestone", "evidence", "dispute", "finance", "expense", "risk"])
});

const lifecycleActionSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  owner: z.enum(["client", "professional", "ops", "system"])
});

const lifecycleRiskSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  level: z.enum(["low", "medium", "high", "critical"]),
  disputeRisk: z.number().min(0).max(1),
  budgetOverrunRisk: z.number().min(0).max(1),
  scheduleRisk: z.number().min(0).max(1),
  calculatedAt: z.string().datetime()
});

export const projectLifecycleProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.string().regex(/^project-lifecycle\.v1:[a-f0-9]{64}$/),
  generatedAt: z.string().datetime(),
  sourceUpdatedAt: z.string().datetime(),
  project: z.object({
    id: z.string().min(1),
    tenantId: z.string().min(1),
    jobId: z.string().min(1),
    title: z.string().min(1),
    commercialStage: projectCommercialStageSchema,
    executionStage: projectStatusSchema,
    ownerOrgId: z.string().min(1),
    startAt: z.string().datetime().nullable(),
    dueAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  }),
  progress: z.object({
    percentage: z.number().int().min(0).max(100),
    milestones: z.object({
      total: z.number().int().nonnegative(),
      completed: z.number().int().nonnegative(),
      paid: z.number().int().nonnegative(),
      pending: z.number().int().nonnegative(),
      awaitingReview: z.number().int().nonnegative(),
      rejected: z.number().int().nonnegative()
    }),
    evidence: z.object({
      total: z.number().int().nonnegative(),
      passed: z.number().int().nonnegative(),
      pending: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
      missingRequired: z.number().int().nonnegative(),
      rejectedRequired: z.number().int().nonnegative()
    })
  }),
  financial: z.object({
    currency: z.string().min(1).nullable(),
    planned: z.number().nonnegative(),
    actualExpenses: z.number().nonnegative(),
    forecastAtCompletion: z.number().nonnegative(),
    forecastMethod: z.literal("max(planned,actual_expenses)"),
    expensesByCurrency: z.array(
      z.object({
        currency: z.string().min(1),
        amount: z.number().nonnegative()
      })
    ),
    deposited: z.number().nonnegative(),
    released: z.number().nonnegative(),
    holdback: z.number().nonnegative(),
    fees: z.number().nonnegative(),
    refunded: z.number().nonnegative(),
    available: z.number(),
    fundingGap: z.number().nonnegative(),
    unreleased: z.number().nonnegative()
  }),
  risk: lifecycleRiskSchema.nullable(),
  blockers: z.array(lifecycleBlockerSchema),
  nextAction: lifecycleActionSchema,
  sources: z.object({
    complete: z.boolean(),
    missing: z.array(z.string().min(1)),
    methodVersion: z.literal("project-lifecycle.v1")
  })
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
export type ProjectCommercialStage = z.infer<typeof projectCommercialStageSchema>;
export type ProjectLifecycleProjection = z.infer<typeof projectLifecycleProjectionSchema>;
export type UpdateProjectStatus = z.infer<typeof updateProjectStatusSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
