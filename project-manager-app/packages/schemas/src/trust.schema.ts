import { z } from "zod";

export const trustReasonSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  message: z.string().min(1)
});

export const trustSnapshotSchema = z.object({
  tenantId: z.string().min(1),
  scopeType: z.enum(["job", "project"]),
  scopeId: z.string().min(1),
  jobId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  score: z.number().int().min(0).max(100),
  level: z.enum(["low", "medium", "high"]),
  flags: z.array(z.string().min(1)),
  reasons: z.array(trustReasonSchema),
  signals: z.object({
    contract: z.object({
      exists: z.boolean(),
      signedClient: z.boolean(),
      signedProfessional: z.boolean()
    }),
    disputes: z.object({
      open: z.number().int().nonnegative(),
      assigned: z.number().int().nonnegative(),
      resolved: z.number().int().nonnegative()
    }),
    milestones: z.object({
      total: z.number().int().nonnegative(),
      draft: z.number().int().nonnegative(),
      submitted: z.number().int().nonnegative(),
      approved: z.number().int().nonnegative(),
      rejected: z.number().int().nonnegative(),
      paid: z.number().int().nonnegative(),
      submittedWithoutEvidence: z.number().int().nonnegative()
    }),
    evidence: z.object({
      total: z.number().int().nonnegative()
    }),
    payments: z.object({
      failed: z.number().int().nonnegative(),
      released: z.number().int().nonnegative(),
      funded: z.number().int().nonnegative()
    }),
    riskScore: z
      .object({
        score: z.number(),
        modelVersion: z.string().min(1),
        computedAt: z.string().min(1)
      })
      .optional()
  }),
  lastUpdatedAt: z.string().min(1)
});
