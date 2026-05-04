import { z } from "zod";

export const agentActionTypeSchema = z.enum([
  // Lectura / Análisis — sin efectos, no requieren aprobación
  "READ_CONTEXT",
  "ANALYZE_EVIDENCE",
  "ASSESS_RISK",
  // Comunicación / Solicitud — riesgo bajo
  "REQUEST_MISSING_EVIDENCE",
  "DRAFT_MESSAGE",
  "DRAFT_SCOPE_CHANGE",
  // Workflow / Estado — riesgo medio
  "PROPOSE_MILESTONE_UPDATE",
  "PROPOSE_JOB_STATUS_CHANGE",
  // Financiero — riesgo alto, requiere aprobación humana
  "PROPOSE_MILESTONE_APPROVAL",
  "PROPOSE_ESCROW_RELEASE",
  // Disputas — riesgo alto
  "PROPOSE_DISPUTE_OPEN",
  "PROPOSE_DISPUTE_RESOLVE",
  // Escalación
  "ESCALATE_TO_HUMAN",
]);

export const agentActionDomainSchema = z.enum([
  "jobs",
  "milestones",
  "evidence",
  "escrow",
  "disputes",
  "scope",
  "internal",
]);

// "none" = ejecuta sin pasar por approval
// "recommended" = registra approval y ejecuta sin bloquear
// "required" = bloquea ejecución hasta aprobación humana explícita
export const agentApprovalModeSchema = z.enum(["none", "recommended", "required"]);

export const agentActionSchema = z.object({
  id: z.string(),
  type: agentActionTypeSchema,
  domain: agentActionDomainSchema,
  summary: z.string(),
  rationale: z.string(),
  requiredInputs: z.array(z.string()),
  riskLevel: z.enum(["low", "medium", "high"]),
  approvalMode: agentApprovalModeSchema,
  toolCall: z
    .object({
      toolName: z.string(),
      payload: z.record(z.unknown()),
    })
    .optional(),
  expectedOutcome: z.string(),
  eligibleAt: z.string().optional(),
});

export type AgentAction = z.infer<typeof agentActionSchema>;
export type AgentActionType = z.infer<typeof agentActionTypeSchema>;
export type AgentApprovalMode = z.infer<typeof agentApprovalModeSchema>;
export type AgentActionDomain = z.infer<typeof agentActionDomainSchema>;
