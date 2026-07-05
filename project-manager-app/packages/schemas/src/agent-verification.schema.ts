import { z } from "zod";

/**
 * agent-verification.schema.ts — SPEC-AGT-001 (bloque AGT-001-A)
 * Espejo Zod de packages/agents/src/verification.ts.
 * Deriva de ADR-021. Se mantiene sincronizado a mano igual que
 * agent-governance.schema.ts respecto de governance.ts.
 */

export const verifierNameSchema = z.enum([
  "verify.typecheck",
  "verify.lint",
  "verify.unit_tests",
  "verify.build",
  "verify.schema",
  "verify.custom"
]);

export const verificationAttemptStatusSchema = z.enum(["pass", "fail", "skipped", "error"]);

export const verificationFinalStatusSchema = z.enum(["verified", "exhausted", "not_applicable"]);

export const HARD_MAX_VERIFICATION_ITERATIONS = 5;

export const verificationBudgetSchema = z.object({
  maxIterations: z
    .number()
    .int()
    .min(1)
    .max(HARD_MAX_VERIFICATION_ITERATIONS),
  maxTokens: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
  /** Regla P2 (ADR-021): un run de escritura sin criterios es denegable. */
  successCriteria: z.array(verifierNameSchema).min(1)
});

export const verificationAttemptSchema = z.object({
  iteration: z.number().int().min(1),
  verifier: verifierNameSchema,
  status: verificationAttemptStatusSchema,
  durationMs: z.number().int().min(0),
  evidence: z.string().max(4096).optional()
});

export const verificationReportSchema = z.object({
  budget: verificationBudgetSchema,
  attempts: z.array(verificationAttemptSchema),
  finalStatus: verificationFinalStatusSchema,
  iterationsUsed: z.number().int().min(0),
  tokensUsed: z.number().int().min(0).optional()
});

export const delegateProfileSchema = z.enum(["explore", "general"]);

export type VerificationBudgetInput = z.infer<typeof verificationBudgetSchema>;
export type VerificationAttemptInput = z.infer<typeof verificationAttemptSchema>;
export type VerificationReportInput = z.infer<typeof verificationReportSchema>;
