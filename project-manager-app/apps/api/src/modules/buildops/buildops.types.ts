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

