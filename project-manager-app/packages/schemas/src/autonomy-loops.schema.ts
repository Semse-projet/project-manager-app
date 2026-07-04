import { z } from "zod";

/**
 * autonomy-loops.schema.ts — SPEC-AUT-001 (Permanent Loops v1).
 * Espejo Zod de packages/autonomy/src/loops/loop-types.ts para validar
 * los cycle-reports que el worker envía a la API.
 */

export const loopFindingKindSchema = z.enum([
  "dedup.candidate",
  "drift.missing_path",
  "drift.missing_test",
  "drift.done_without_tests",
  "drift.missing_command",
  "drift.invalid_status"
]);

export const loopCycleStatusSchema = z.enum([
  "completed",
  "skipped_disabled",
  "skipped_paused",
  "skipped_backpressure",
  "skipped_no_repo",
  "failed"
]);

export const loopFindingSchema = z.object({
  loopId: z.string().min(1),
  target: z.string().min(1),
  kind: loopFindingKindSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  evidence: z.record(z.string(), z.unknown()).optional()
});

export const loopAuditEventSchema = z.object({
  type: z.string().min(1),
  status: z.enum(["ok", "warn", "error"]),
  timestamp: z.string().min(1),
  detail: z.record(z.string(), z.unknown())
});

export const loopSuppressedFindingSchema = z.object({
  target: z.string().min(1),
  reason: z.enum(["below_min_confidence", "recently_rejected", "over_proposal_budget"])
});

export const loopCycleReportSchema = z.object({
  loopId: z.string().min(1),
  status: loopCycleStatusSchema,
  startedAt: z.string().min(1),
  finishedAt: z.string().min(1),
  durationMs: z.number().min(0),
  findings: z.array(loopFindingSchema),
  proposalsPlanned: z.array(loopFindingSchema),
  suppressed: z.array(loopSuppressedFindingSchema),
  auditEvents: z.array(loopAuditEventSchema),
  metrics: z.record(z.string(), z.number()),
  artifacts: z.record(z.string(), z.string()).optional()
});

export type LoopCycleReportInput = z.infer<typeof loopCycleReportSchema>;
export type LoopFindingInput = z.infer<typeof loopFindingSchema>;
