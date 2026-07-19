import { z } from "zod";

// ── Shared enums ─────────────────────────────────────────────────────────────

/** Specialist agents Prometeo can consult internally. */
export const prometeoAgentIdSchema = z.enum(["marta", "felix", "pulse", "just", "planner"]);
export type PrometeoAgentId = z.infer<typeof prometeoAgentIdSchema>;

/** Orchestration FSM states (see docs/foundation/STATE_MACHINES.md). */
export const orchestrationStatusSchema = z.enum([
  "idle",
  "interpreting",
  "ambiguity_resolving",
  "agent_consultation",
  "execution",
  "completed",
  "failed",
]);
export type OrchestrationStatus = z.infer<typeof orchestrationStatusSchema>;

// ── POST /v1/prometeo/orchestrate ────────────────────────────────────────────

export const prometeoOrchestrationRequestSchema = z.object({
  message: z.string().min(1).max(5000),
  context: z
    .object({
      projectId: z.string().uuid().optional(),
      currentScreen: z.string().optional(),
      permissions: z.array(z.string()).optional(),
    })
    .optional(),
  sessionId: z.string().uuid().optional(),
  preferredAgents: z.array(prometeoAgentIdSchema).optional(),
});
export type PrometeoOrchestrationRequest = z.infer<typeof prometeoOrchestrationRequestSchema>;

export const orchestrationEntitySchema = z.object({
  type: z.string(),
  value: z.string(),
});
export type OrchestrationEntity = z.infer<typeof orchestrationEntitySchema>;

export const orchestrationInterpretationSchema = z.object({
  intent: z.string(),
  confidence: z.number(),
  entities: z.array(orchestrationEntitySchema),
});
export type OrchestrationInterpretation = z.infer<typeof orchestrationInterpretationSchema>;

export const orchestrationAgentResultSchema = z.object({
  agentId: z.string(),
  status: z.enum(["pending", "completed", "failed"]),
  result: z.unknown().optional(),
});
export type OrchestrationAgentResult = z.infer<typeof orchestrationAgentResultSchema>;

export const orchestrationStepSchema = z.object({
  action: z.string(),
  agent: z.string().optional(),
  parameters: z.unknown(),
});
export type OrchestrationStep = z.infer<typeof orchestrationStepSchema>;

export const prometeoOrchestrationResponseSchema = z.object({
  orchestrationId: z.string(),
  interpretation: orchestrationInterpretationSchema,
  agentsConsulted: z.array(orchestrationAgentResultSchema),
  plan: z.object({
    steps: z.array(orchestrationStepSchema),
  }),
  status: orchestrationStatusSchema,
  requiresApproval: z.boolean(),
});
export type PrometeoOrchestrationResponse = z.infer<typeof prometeoOrchestrationResponseSchema>;

// ── POST /v1/prometeo/agents/:agentId/consult ────────────────────────────────

export const agentConsultationRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  context: z
    .object({
      projectId: z.string().uuid().optional(),
      jobId: z.string().uuid().optional(),
    })
    .optional(),
});
export type AgentConsultationRequest = z.infer<typeof agentConsultationRequestSchema>;

export const orchestrationSuggestedActionSchema = z.object({
  action: z.string(),
  description: z.string(),
});
export type OrchestrationSuggestedAction = z.infer<typeof orchestrationSuggestedActionSchema>;

export const agentConsultationResponseSchema = z.object({
  consultationId: z.string(),
  agentId: prometeoAgentIdSchema,
  agentResponse: z.string(),
  requiresAction: z.boolean(),
  suggestedActions: z.array(orchestrationSuggestedActionSchema),
});
export type AgentConsultationResponse = z.infer<typeof agentConsultationResponseSchema>;

// ── GET /v1/prometeo/orchestration/:orchestrationId ──────────────────────────

export const orchestrationStatusResponseSchema = z.object({
  orchestrationId: z.string(),
  status: orchestrationStatusSchema,
  currentStep: z.string(),
  agentsStatus: z.record(z.string(), z.string()),
  result: z.unknown().optional(),
  errors: z.array(
    z.object({
      message: z.string(),
      agent: z.string().optional(),
    }),
  ),
});
export type OrchestrationStatusResponse = z.infer<typeof orchestrationStatusResponseSchema>;
