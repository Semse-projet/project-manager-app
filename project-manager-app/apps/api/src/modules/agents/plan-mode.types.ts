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
  | "delegating";

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
