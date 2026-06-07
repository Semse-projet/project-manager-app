export type BridgeEstimateStatus = "ready" | "needs_more_info" | "not_available";

export type BridgePaymentReadinessStatus = "not_ready" | "draft" | "ready";

export type BridgeMatchingCandidate = {
  userId: string;
  displayName: string;
  publicSlug: string | null;
  score: number;
  verificationStatus: string;
  completedJobs: number;
  trustScore: number;
};

export type BridgeMatchingSummary = {
  status: "ready" | "no_candidates" | "not_available";
  candidatesEvaluated: number;
  candidateCount: number;
  topCandidates: BridgeMatchingCandidate[];
  preferredCandidateStatus: string | null;
  algorithmVersion: string | null;
  computedAt: string | null;
};

export type BridgeMilestoneSummary = {
  key: string;
  sequence: number;
  title: string;
  description: string;
  percentage: number;
  amount: number;
  evidenceRequired: string[];
  releaseTrigger: string;
};

export type BridgeEvidenceRequirementSummary = {
  key: string;
  type: "photo" | "video" | "document" | "measurement" | "inspection";
  description: string;
  required: boolean;
  milestone: number | null;
};

export type IntakeOperationsBridgeRerunContext = {
  runReason: string;
  clientPlanReviewComment: string | null;
  previousVersionId: string | null;
  previousVersionNumber: number | null;
  triggeredByUserId: string;
};

export type IntakeOperationsBridgeTaskTemplate = {
  templateKey: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  evidenceRequired: Record<string, unknown>;
};

export type IntakeOperationsBridgeComputationResult = {
  jobId: string;
  projectIntakeId: string | null;
  projectPatch: {
    title: string;
    description: string;
    trade: string;
    projectType: string;
    clientName: string;
    location: string;
    budgetEstimate: number | null;
    status: string;
    riskScore: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    sourceTool: string;
    completion: number;
  };
  sourceToolInput: Record<string, unknown>;
  sourceToolResult: Record<string, unknown>;
  taskTemplates: IntakeOperationsBridgeTaskTemplate[];
  estimate: {
    status: BridgeEstimateStatus;
    scopeSummary: string;
    missingInputs: string[];
    tool: string | null;
    quoteTotal: number | null;
  };
  matching: BridgeMatchingSummary;
  milestones: {
    count: number;
    items: BridgeMilestoneSummary[];
  };
  evidenceRequirements: {
    count: number;
    items: BridgeEvidenceRequirementSummary[];
  };
  paymentReadiness: {
    status: BridgePaymentReadinessStatus;
    ready: boolean;
    reason: string | null;
    suggestedDeposit: number | null;
    suggestedEscrow: number | null;
    checks: Record<string, boolean>;
  };
};

export type IntakeOperationsBridgeResult = {
  projectIntakeId: string | null;
  jobId: string;
  buildOpsProjectId: string;
  buildOpsTaskIds: string[];
  tasksCreated: number;
  tasksReused: number;
  estimate: {
    status: BridgeEstimateStatus;
    scopeSummary: string;
    missingInputs: string[];
    tool: string | null;
    quoteTotal: number | null;
  };
  matching: BridgeMatchingSummary;
  milestones: {
    storage: "buildops_project.sourceToolResult";
    count: number;
    created: number;
    reused: number;
    items: BridgeMilestoneSummary[];
  };
  evidenceRequirements: {
    storage: "buildops_project.sourceToolResult";
    count: number;
    created: number;
    reused: number;
    items: BridgeEvidenceRequirementSummary[];
  };
  paymentReadiness: {
    status: BridgePaymentReadinessStatus;
    ready: boolean;
    reason: string | null;
    suggestedDeposit: number | null;
    suggestedEscrow: number | null;
    checks: Record<string, boolean>;
  };
  idempotency: {
    reusedBuildOpsProject: boolean;
    reusedTasks: boolean;
    reusedMilestones: boolean;
    reusedEvidenceRequirements: boolean;
  };
};
