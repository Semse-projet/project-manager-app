import type { AgentActionType, AgentApprovalMode } from "@semse/schemas";

type ActionPolicy = {
  approvalMode: AgentApprovalMode;
  riskLevel: "low" | "medium" | "high";
};

// Matriz canónica: qué puede hacer el agente sin aprobación, con aprobación recomendada, o bloqueado
const ACTION_POLICY_MATRIX: Record<AgentActionType, ActionPolicy> = {
  READ_CONTEXT:               { approvalMode: "none",        riskLevel: "low" },
  ANALYZE_EVIDENCE:           { approvalMode: "none",        riskLevel: "low" },
  ASSESS_RISK:                { approvalMode: "none",        riskLevel: "low" },
  REQUEST_MISSING_EVIDENCE:   { approvalMode: "none",        riskLevel: "low" },
  DRAFT_MESSAGE:              { approvalMode: "none",        riskLevel: "low" },
  DRAFT_SCOPE_CHANGE:         { approvalMode: "recommended", riskLevel: "medium" },
  PROPOSE_MILESTONE_UPDATE:   { approvalMode: "recommended", riskLevel: "medium" },
  PROPOSE_JOB_STATUS_CHANGE:  { approvalMode: "recommended", riskLevel: "medium" },
  PROPOSE_MILESTONE_APPROVAL: { approvalMode: "required",    riskLevel: "high" },
  PROPOSE_ESCROW_RELEASE:     { approvalMode: "required",    riskLevel: "high" },
  PROPOSE_DISPUTE_OPEN:       { approvalMode: "required",    riskLevel: "high" },
  PROPOSE_DISPUTE_RESOLVE:    { approvalMode: "required",    riskLevel: "high" },
  ESCALATE_TO_HUMAN:          { approvalMode: "none",        riskLevel: "low" },
};

export function getActionPolicy(type: AgentActionType): ActionPolicy {
  return ACTION_POLICY_MATRIX[type];
}

// Si el riesgo en contexto es mayor que el de la política base, escala el approvalMode
export function resolveApprovalMode(
  type: AgentActionType,
  riskOverride?: "low" | "medium" | "high"
): AgentApprovalMode {
  const base = ACTION_POLICY_MATRIX[type];
  if (riskOverride === "high" && base.approvalMode !== "required") return "required";
  return base.approvalMode;
}
