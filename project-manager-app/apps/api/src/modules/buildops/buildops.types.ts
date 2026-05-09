export type BuildOpsProjectStatus =
  | "draft"
  | "estimating"
  | "quoted"
  | "approved"
  | "in_progress"
  | "paused"
  | "completed"
  | "dispute"
  | "closed";

export type BuildOpsRiskLevel = "low" | "medium" | "high" | "critical";

export type BuildOpsTaskStatus = "todo" | "in_progress" | "blocked" | "done" | "canceled";
export type BuildOpsTaskPriority = "low" | "medium" | "high" | "urgent";

export type BuildOpsMilestoneStatus = "draft" | "awaiting_review" | "submitted" | "approved" | "rejected" | "paid";

export type BuildOpsOverviewDto = {
  activeProjects: number;
  draftEstimates: number;
  tasksDue: number;
  milestonesPending: number;
  evidencePending: number;
  riskAlerts: number;
  recentActivity: string[];
};

export type BuildOpsProjectDto = {
  id: string;
  tenantId: string;
  orgId: string;
  createdBy: string;
  title: string;
  description: string | null;
  trade: string;
  projectType: string;
  clientName: string;
  professionalName: string | null;
  location: string;
  budgetEstimate: number | null;
  status: BuildOpsProjectStatus;
  riskScore: number;
  riskLevel: BuildOpsRiskLevel;
  startDate: string | null;
  dueDate: string | null;
  sourceTool: string | null;
  sourceToolInput: Record<string, unknown> | null;
  sourceToolResult: Record<string, unknown> | null;
  completion: number;
  createdAt: string;
  updatedAt: string;
};

export type BuildOpsTaskDto = {
  id: string;
  tenantId: string;
  orgId: string;
  projectId: string | null;
  createdBy: string;
  title: string;
  description: string | null;
  status: BuildOpsTaskStatus;
  priority: BuildOpsTaskPriority;
  assigneeName: string | null;
  assigneeUserId: string | null;
  dueDate: string | null;
  completion: number;
  sourceTool: string | null;
  evidenceRequired: Record<string, unknown> | null;
  projectTitle: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BuildOpsMilestoneDto = {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  description: string | null;
  amount: number;
  sequence: number;
  status: BuildOpsMilestoneStatus;
  evidenceCount: number;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
