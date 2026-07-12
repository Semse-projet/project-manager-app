import { z } from "zod";

export const prometeoAttachmentTypeSchema = z.enum(["image", "video", "audio", "document", "file"]);
export const prometeoAttachmentSourceSchema = z.enum([
  "upload",
  "camera",
  "gallery",
  "existing_evidence",
  "external_url",
  "clipboard",
]);

export const prometeoAttachmentSchema = z.object({
  id: z.string().trim().min(1).optional(),
  fileId: z.string().trim().min(1).optional(),
  evidenceId: z.string().trim().min(1).optional(),
  type: prometeoAttachmentTypeSchema,
  source: prometeoAttachmentSourceSchema.default("upload"),
  name: z.string().trim().min(1).optional(),
  mimeType: z.string().trim().min(1).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  url: z.string().trim().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const prometeoEntityReferenceSchema = z.object({
  type: z.string().trim().min(1),
  id: z.string().trim().min(1),
  label: z.string().trim().min(1).optional(),
  namespace: z.string().trim().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const prometeoPageContextSchema = z.object({
  route: z.string().trim().min(1).optional(),
  module: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  entity: prometeoEntityReferenceSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const prometeoRequestSchema = z.object({
  message: z.string().trim().optional(),
  attachments: z.array(prometeoAttachmentSchema).default([]),
  selectedEntities: z.array(prometeoEntityReferenceSchema).default([]),
  requestedAction: z.string().trim().min(1).optional(),
  requestedActionInput: z.record(z.unknown()).optional(),
  threadId: z.string().trim().min(1).optional(),
  missionId: z.string().trim().min(1).optional(),
  agentId: z.string().trim().min(1).optional(),
  projectId: z.string().trim().min(1).optional(),
  pageContext: prometeoPageContextSchema.optional(),
  context: z.unknown().optional(),
}).superRefine((value, ctx) => {
  if (!value.message && value.attachments.length === 0 && !value.requestedAction) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "message, attachments, or requestedAction is required",
      path: ["message"],
    });
  }
});

export const prometeoResponseBlockStatusSchema = z.enum([
  "info",
  "pending",
  "running",
  "completed",
  "blocked",
  "failed",
  "skipped",
]);

export const prometeoResponseBlockSchema = z.object({
  id: z.string().trim().min(1),
  type: z.string().trim().min(1),
  title: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1).optional(),
  status: prometeoResponseBlockStatusSchema.default("info"),
  payload: z.record(z.unknown()).optional(),
});

export const prometeoRiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export const prometeoApprovalPolicySchema = z.enum(["none", "confirm", "human_required", "dual_approval"]);

export const prometeoProposedActionSchema = z.object({
  id: z.string().trim().min(1),
  namespace: z.string().trim().min(1),
  tool: z.string().trim().min(1),
  label: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  riskLevel: prometeoRiskLevelSchema.default("low"),
  approvalPolicy: prometeoApprovalPolicySchema.default("none"),
  requiresApproval: z.boolean().default(false),
  status: z.enum(["proposed", "awaiting_approval", "approved", "rejected", "blocked"]).default("proposed"),
  input: z.record(z.unknown()).optional(),
  reason: z.string().trim().min(1).optional(),
});

export const prometeoToolExecutionResultSchema = z.object({
  id: z.string().trim().min(1),
  actionId: z.string().trim().min(1).optional(),
  namespace: z.string().trim().min(1),
  tool: z.string().trim().min(1),
  status: z.enum(["queued", "running", "succeeded", "failed", "skipped", "blocked"]),
  output: z.unknown().optional(),
  errorMessage: z.string().trim().min(1).optional(),
  auditRef: z.string().trim().min(1).optional(),
  startedAt: z.string().trim().min(1).optional(),
  completedAt: z.string().trim().min(1).optional(),
});

export const prometeoMissionStepSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  status: z.enum(["pending", "running", "completed", "blocked", "failed", "skipped"]),
  detail: z.string().trim().min(1).optional(),
});

export const prometeoMissionStateSchema = z.object({
  id: z.string().trim().min(1),
  status: z.enum(["draft", "running", "waiting_input", "waiting_approval", "completed", "failed", "cancelled"]),
  phase: z.string().trim().min(1),
  goal: z.string().trim().min(1).optional(),
  steps: z.array(prometeoMissionStepSchema).default([]),
  pendingApprovals: z.array(z.string().trim().min(1)).default([]),
  traceId: z.string().trim().min(1).optional(),
});

export const prometeoCitationSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum(["document", "evidence", "tool", "audit", "system"]),
  label: z.string().trim().min(1).optional(),
  excerpt: z.string().trim().min(1).optional(),
  url: z.string().trim().min(1).optional(),
  score: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const prometeoResponseSchema = z.object({
  message: z.string(),
  blocks: z.array(prometeoResponseBlockSchema).default([]),
  proposedActions: z.array(prometeoProposedActionSchema).default([]),
  executionResults: z.array(prometeoToolExecutionResultSchema).default([]),
  mission: prometeoMissionStateSchema.optional(),
  citations: z.array(prometeoCitationSchema).default([]),
  refreshTargets: z.array(z.string().trim().min(1)).default([]),
});

export const prometeoToolInvokeSchema = z.object({
  namespace: z.string().trim().min(1),
  name: z.string().trim().min(1),
  input: z.record(z.unknown()).default({}),
  threadId: z.string().trim().min(1).optional(),
  missionId: z.string().trim().min(1).optional(),
});

export const prometeoToolModeSchema = z.enum(["read", "write", "critical"]);
export const prometeoToolDescriptorSchema = z.object({
  namespace: z.string().trim().min(1),
  name: z.string().trim().min(1),
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  mode: prometeoToolModeSchema,
  riskLevel: prometeoRiskLevelSchema,
  approvalPolicy: prometeoApprovalPolicySchema,
  permissions: z.array(z.string().trim().min(1)).default([]),
  endpoint: z.object({
    method: z.enum(["GET", "POST", "PATCH", "DELETE"]),
    path: z.string().trim().min(1),
  }).optional(),
  inputSchema: z.record(z.unknown()).optional(),
  outputKind: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
});

export type PrometeoAttachmentType = z.infer<typeof prometeoAttachmentTypeSchema>;
export type PrometeoAttachmentSource = z.infer<typeof prometeoAttachmentSourceSchema>;
export type PrometeoAttachment = z.infer<typeof prometeoAttachmentSchema>;
export type PrometeoEntityReference = z.infer<typeof prometeoEntityReferenceSchema>;
export type PrometeoPageContext = z.infer<typeof prometeoPageContextSchema>;
export type PrometeoRequest = z.infer<typeof prometeoRequestSchema>;
export type PrometeoResponseBlock = z.infer<typeof prometeoResponseBlockSchema>;
export type PrometeoProposedAction = z.infer<typeof prometeoProposedActionSchema>;
export type PrometeoToolExecutionResult = z.infer<typeof prometeoToolExecutionResultSchema>;
export type PrometeoMissionStep = z.infer<typeof prometeoMissionStepSchema>;
export type PrometeoMissionState = z.infer<typeof prometeoMissionStateSchema>;
export type PrometeoCitation = z.infer<typeof prometeoCitationSchema>;
export type PrometeoResponse = z.infer<typeof prometeoResponseSchema>;
export type PrometeoToolInvokeInput = z.infer<typeof prometeoToolInvokeSchema>;
export type PrometeoToolDescriptor = z.infer<typeof prometeoToolDescriptorSchema>;
