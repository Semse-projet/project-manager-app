export type MobileAgentId =
  | "mobile-job-copilot"
  | "mobile-evidence-coach"
  | "mobile-travel-assistant"
  | "mobile-dispute-briefing-agent"
  | "mobile-field-ops-guide"
  | "mobile-client-project-guide"
  | "mobile-dev-observer";

export type MobileAgentDescriptor = {
  id: MobileAgentId;
  purpose: string;
  riskLevel: "low" | "medium" | "high";
  humanApprovalRequired: boolean;
};

export const MOBILE_AGENT_REGISTRY: readonly MobileAgentDescriptor[] = [
  { id: "mobile-job-copilot", purpose: "orientar trabajo y siguiente paso", riskLevel: "low", humanApprovalRequired: false },
  { id: "mobile-evidence-coach", purpose: "guiar captura de evidencia valida", riskLevel: "low", humanApprovalRequired: false },
  { id: "mobile-travel-assistant", purpose: "asistir movilidad y liquidacion", riskLevel: "medium", humanApprovalRequired: false },
  { id: "mobile-dispute-briefing-agent", purpose: "resumir disputa y contexto", riskLevel: "medium", humanApprovalRequired: false },
  { id: "mobile-field-ops-guide", purpose: "guiar campo y tracker", riskLevel: "medium", humanApprovalRequired: false },
  { id: "mobile-client-project-guide", purpose: "asistir al cliente en proyectos e hitos", riskLevel: "medium", humanApprovalRequired: false },
  { id: "mobile-dev-observer", purpose: "explicar estado tecnico del sistema", riskLevel: "low", humanApprovalRequired: false },
] as const;
