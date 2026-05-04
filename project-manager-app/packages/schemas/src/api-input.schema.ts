import { z } from "zod";

const nonEmptyId = z.string().trim().min(1);

export const authTokenBodySchema = z.object({
  userId: nonEmptyId,
  tenantId: nonEmptyId,
  orgId: nonEmptyId,
  roles: z.array(z.string().trim().min(1)).default([]),
  ttlSeconds: z.number().int().positive().max(60 * 60 * 24).optional()
});

export const authRefreshBodySchema = z.object({
  refreshToken: nonEmptyId
});

export const authPasswordResetRequestSchema = z.object({
  email: z.string().trim().email()
});

export const authPasswordResetConfirmSchema = z.object({
  token: nonEmptyId,
  newPassword: z.string().min(12).max(128)
});

export const milestoneCreateSchema = z.object({
  title: z.string().trim().min(1),
  amount: z.number().positive(),
  sequence: z.number().int().positive()
});

export const milestoneReasonSchema = z.object({
  reason: z.string().trim().min(1)
});

export const orgIdParamSchema = z.object({
  orgId: nonEmptyId
});

export const userIdParamSchema = z.object({
  userId: nonEmptyId
});

export const ratingIdParamSchema = z.object({
  ratingId: nonEmptyId
});

export const runIdParamSchema = z.object({
  runId: nonEmptyId
});

export const correlationIdParamSchema = z.object({
  correlationId: nonEmptyId
});

export const approvalIdParamSchema = z.object({
  approvalId: nonEmptyId
});

export const alertIdParamSchema = z.object({
  alertId: nonEmptyId
});

export const runbookIdParamSchema = z.object({
  runbookId: nonEmptyId
});

export const opsIncidentSchema = z.object({
  severity: z.enum(["watch", "critical"]).default("critical"),
  title: z.string().trim().min(1).max(160).default("Manual incident reported from Cortex")
});

export const opsAgentRuntimeQuerySchema = z.object({
  correlationId: z.string().trim().min(1).optional(),
  eventType: z.string().trim().min(1).optional(),
  agentType: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
  triggerType: z.string().trim().min(1).optional(),
  workspaceId: z.string().trim().min(1).optional(),
  operatorId: z.string().trim().min(1).optional(),
  memoryTag: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).optional()
});

export const userVerificationBodySchema = z.object({
  verificationType: z
    .enum(["email", "phone", "id_document", "background_check"])
    .default("email")
});

export const userStatusUpdateBodySchema = z.object({
  status: z.enum(["active", "pending", "suspended"])
});

export const userProfileUpdateBodySchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  bio: z.string().trim().max(500).optional(),
  location: z.string().trim().max(100).optional(),
  trades: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  availability: z.boolean().optional(),
  assistantTone: z.enum(["friendly", "formal", "technical", "executive"]).optional(),
  assistantLanguage: z.enum(["es", "en"]).optional(),
  assistantVerbosity: z.enum(["short", "balanced", "detailed"]).optional(),
  unifiedMode: z.boolean().optional(),
  expertMode: z.boolean().optional(),
});

export const ratingCreateSchema = z.object({
  jobId: nonEmptyId,
  toUserId: nonEmptyId,
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(1000).optional()
});
