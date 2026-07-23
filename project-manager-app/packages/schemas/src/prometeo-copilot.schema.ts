import { z } from "zod";
import { workspaceMissionTypeSchema } from "./workspace.schema.js";

// ── POST /v1/prometeo/copilot/context ────────────────────────────────────────

export const copilotContextRequestSchema = z.object({
  currentUrl: z.string().min(1),
  additionalContext: z
    .object({
      resourceId: z.string().optional(),
      resourceType: z.string().optional(),
    })
    .optional(),
});
export type CopilotContextRequest = z.infer<typeof copilotContextRequestSchema>;

export const copilotSuggestedActionSchema = z.object({
  action: z.string(),
  description: z.string(),
});
export type CopilotSuggestedAction = z.infer<typeof copilotSuggestedActionSchema>;

export const copilotResourceSchema = z.object({
  id: z.string().nullable(),
  type: z.string(),
  data: z.unknown().nullable(),
});
export type CopilotResource = z.infer<typeof copilotResourceSchema>;

export const copilotContextResponseSchema = z.object({
  module: z.string(),
  resource: copilotResourceSchema,
  permissions: z.array(z.string()),
  suggestedActions: z.array(copilotSuggestedActionSchema),
  confidence: z.number(),
});
export type CopilotContextResponse = z.infer<typeof copilotContextResponseSchema>;

// ── POST /v1/prometeo/copilot/message ────────────────────────────────────────

export const copilotMessageRequestSchema = z.object({
  message: z.string().min(1).max(5000),
  context: z
    .object({
      module: z.string(),
      resource: copilotResourceSchema.optional(),
      permissions: z.array(z.string()).optional(),
    })
    .optional(),
  sessionId: z.string().uuid().optional(),
});
export type CopilotMessageRequest = z.infer<typeof copilotMessageRequestSchema>;

export const copilotMissionSuggestionSchema = z.object({
  title: z.string(),
  type: workspaceMissionTypeSchema,
  reason: z.string(),
});
export type CopilotMissionSuggestion = z.infer<typeof copilotMissionSuggestionSchema>;

export const copilotMessageResponseSchema = z.object({
  sessionId: z.string().uuid(),
  response: z.string(),
  suggestedActions: z.array(copilotSuggestedActionSchema),
  requiresWorkspace: z.boolean(),
  missionSuggestion: copilotMissionSuggestionSchema.optional(),
});
export type CopilotMessageResponse = z.infer<typeof copilotMessageResponseSchema>;

// ── POST /v1/prometeo/copilot/mission/create ─────────────────────────────────

export const createMissionFromCopilotRequestSchema = z.object({
  copilotSessionId: z.string().uuid(),
  missionType: workspaceMissionTypeSchema,
  title: z.string().min(1).max(200),
});
export type CreateMissionFromCopilotRequest = z.infer<typeof createMissionFromCopilotRequestSchema>;

export const missionCreationResponseSchema = z.object({
  missionId: z.string().uuid(),
  title: z.string(),
  type: workspaceMissionTypeSchema,
  workspaceUrl: z.string(),
});
export type MissionCreationResponse = z.infer<typeof missionCreationResponseSchema>;

// ── POST /v1/prometeo/copilot/action/execute ─────────────────────────────────

export const executeCopilotActionRequestSchema = z.object({
  action: z.string().min(1),
  targetResource: z.object({
    resourceId: z.string().min(1),
    resourceType: z.string().min(1),
  }),
  parameters: z.unknown().optional(),
});
export type ExecuteCopilotActionRequest = z.infer<typeof executeCopilotActionRequestSchema>;

export const actionExecutionResponseSchema = z.object({
  actionId: z.string().uuid(),
  status: z.enum(["pending", "completed", "failed"]),
  result: z.unknown().nullable(),
  requiresWorkspace: z.boolean(),
});
export type ActionExecutionResponse = z.infer<typeof actionExecutionResponseSchema>;
