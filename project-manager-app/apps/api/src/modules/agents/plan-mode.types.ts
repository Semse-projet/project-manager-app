export type AgentWorkPlanStatus =
  | "pending_approval"
  | "approved"
  | "executing"
  | "completed"
  | "cancelled"
  | "rejected";

export type AgentPlanStepStatus =
  | "pending"
  | "ready"
  | "executing"
  | "blocked"
  | "completed"
  | "failed"
  | "skipped";

export type AgentPlanStepEvidenceStatus = "missing" | "partial" | "satisfied";
export type PlanStepCapability =
  | "dispute"
  | "searching"
  | "perambulating"
  | "composing"
  | "clouding"
  | "shelling"
  | "editing"
  | "testing"
  | "waiting"
  | "worker"
  | "delegating"
  // Browser automation — QA Sentinel layer
  | "browser-inspect"      // risk: low  — read-only page inspection
  | "browser-test"         // risk: medium — run Playwright specs
  | "browser-screenshot"   // risk: medium — capture visual evidence
  | "browser-audit"        // risk: medium — full page audit
  | "browser-evidence"     // risk: medium — capture and store evidence
  | "browser-form";        // risk: high, requiresApproval: true — fill and submit forms

/** Risk and approval policy for browser capabilities. */
export const BROWSER_CAPABILITY_POLICY: Record<
  Extract<PlanStepCapability, `browser-${string}`>,
  { risk: "low" | "medium" | "high"; requiresApproval: boolean }
> = {
  "browser-inspect":     { risk: "low",    requiresApproval: false },
  "browser-test":        { risk: "medium", requiresApproval: false },
  "browser-screenshot":  { risk: "medium", requiresApproval: false },
  "browser-audit":       { risk: "medium", requiresApproval: false },
  "browser-evidence":    { risk: "medium", requiresApproval: false },
  "browser-form":        { risk: "high",   requiresApproval: true  },
};

export type CopilotPlanBoundAction = {
  actionType: string;
  approvalMode: "manual" | "auto";
  riskLevel: "low" | "medium" | "high";
};

export type CopilotPlanStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  expectedOutcome: string;
  capability: PlanStepCapability;
  toolsAllowed: string[];
  actionType?: string;
  dependsOnStepIds?: string[];
  requiredEvidence?: string[];
  evidenceStatus?: AgentPlanStepEvidenceStatus;
  boundAction?: CopilotPlanBoundAction;
  riskLevel: "low" | "medium" | "high";
  requiresApproval: boolean;
  requiresApprovedPlan: boolean;
  status: AgentPlanStepStatus;
  blockReason?: string;
  startedAt?: string;
  completedAt?: string;
  blockedReason?: string;
};

export type CopilotPlanDraftStep = Omit<
  CopilotPlanStep,
  | "capability"
  | "toolsAllowed"
  | "requiresApprovedPlan"
  | "status"
  | "evidenceStatus"
  | "boundAction"
  | "blockReason"
  | "startedAt"
  | "completedAt"
  | "blockedReason"
> & {
  id?: string;
  capability?: PlanStepCapability;
  toolsAllowed?: string[];
  requiresApprovedPlan?: boolean;
};

export type CopilotPlanDraft = {
  title: string;
  goal: string;
  rationale: string;
  description?: string;
  steps: CopilotPlanDraftStep[];
  risks: string[];
  requiredEvidence: string[];
  successCriteria: string[];
};

export type CopilotProposedPlan = {
  id: string;
  title: string;
  goal: string;
  rationale: string;
  description?: string;
  status: AgentWorkPlanStatus;
  steps: CopilotPlanStep[];
  risks: string[];
  requiredEvidence: string[];
  successCriteria: string[];
  progress?: {
    totalSteps: number;
    completedSteps: number;
    skippedSteps: number;
    blockedSteps: number;
    readySteps: number;
    executingSteps: number;
    failedSteps: number;
    percent: number;
  };
  approvedAt?: string;
  createdAt: string;
};
