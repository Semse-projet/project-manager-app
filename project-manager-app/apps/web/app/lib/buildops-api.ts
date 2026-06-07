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

export type BuildOpsPlanApprovalStatus =
  | "pending"
  | "approved"
  | "changes_requested"
  | "rejected";

export type BuildOpsPlanApprovalSource = "client" | "admin_override";

export type BuildOpsProject = {
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
  riskLevel: "low" | "medium" | "high" | "critical";
  startDate: string | null;
  dueDate: string | null;
  sourceTool: string | null;
  sourceToolInput: Record<string, unknown> | null;
  sourceToolResult: Record<string, unknown> | null;
  completion: number;
  clientPlanApprovalStatus: BuildOpsPlanApprovalStatus;
  clientPlanApprovedAt: string | null;
  clientPlanApprovedById: string | null;
  clientPlanApprovalSource: BuildOpsPlanApprovalSource | null;
  clientPlanReviewedAt: string | null;
  clientPlanReviewComment: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlanApprovalResult = {
  id: string;
  clientPlanApprovalStatus: BuildOpsPlanApprovalStatus;
  clientPlanApprovedAt: string | null;
  clientPlanApprovedById: string | null;
  clientPlanApprovalSource: BuildOpsPlanApprovalSource | null;
  clientPlanReviewedAt: string | null;
  clientPlanReviewComment: string | null;
};

export type BuildOpsOverview = {
  activeProjects: number;
  draftEstimates: number;
  tasksDue: number;
  milestonesPending: number;
  evidencePending: number;
  riskAlerts: number;
  recentActivity: string[];
};

export type BuildOpsTaskStatus = "todo" | "in_progress" | "blocked" | "done" | "canceled";
export type BuildOpsTaskPriority = "low" | "medium" | "high" | "urgent";

export type BuildOpsTask = {
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

export type BuildOpsMilestoneStatus = "draft" | "awaiting_review" | "submitted" | "approved" | "rejected" | "paid";

export type BuildOpsMilestone = {
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

async function parseBuildOpsResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({} as { error?: { message?: string } }));
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "BuildOps request failed");
  }
  return (payload.data ?? payload) as T;
}

export async function fetchBuildOpsOverview(): Promise<BuildOpsOverview> {
  const response = await fetch("/api/semse/buildops/overview", { cache: "no-store" });
  return parseBuildOpsResponse<BuildOpsOverview>(response);
}

export async function fetchBuildOpsProjects(): Promise<BuildOpsProject[]> {
  const response = await fetch("/api/semse/buildops/projects", { cache: "no-store" });
  return parseBuildOpsResponse<BuildOpsProject[]>(response);
}

export async function fetchBuildOpsProject(projectId: string): Promise<BuildOpsProject> {
  const response = await fetch(`/api/semse/buildops/projects/${encodeURIComponent(projectId)}`, { cache: "no-store" });
  return parseBuildOpsResponse<BuildOpsProject>(response);
}

export async function fetchBuildOpsTasks(): Promise<BuildOpsTask[]> {
  const response = await fetch("/api/semse/buildops/tasks", { cache: "no-store" });
  return parseBuildOpsResponse<BuildOpsTask[]>(response);
}

export async function fetchBuildOpsTask(taskId: string): Promise<BuildOpsTask> {
  const response = await fetch(`/api/semse/buildops/tasks/${encodeURIComponent(taskId)}`, { cache: "no-store" });
  return parseBuildOpsResponse<BuildOpsTask>(response);
}

export async function fetchBuildOpsMilestones(): Promise<BuildOpsMilestone[]> {
  const response = await fetch("/api/semse/buildops/milestones", { cache: "no-store" });
  return parseBuildOpsResponse<BuildOpsMilestone[]>(response);
}

export async function createBuildOpsProject(input: {
  title: string;
  description?: string;
  trade: string;
  projectType: string;
  clientName: string;
  professionalName?: string;
  location: string;
  budgetEstimate?: number | string;
  status?: BuildOpsProjectStatus;
  riskScore?: number;
  riskLevel?: BuildOpsProject["riskLevel"];
  startDate?: string;
  dueDate?: string;
}): Promise<BuildOpsProject> {
  const response = await fetch("/api/semse/buildops/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseBuildOpsResponse<BuildOpsProject>(response);
}

export async function createBuildOpsProjectFromToolResult(input: {
  sourceTool: string;
  sourceToolInput: Record<string, unknown>;
  sourceToolResult: Record<string, unknown>;
  title?: string;
  description?: string;
  trade?: string;
  projectType?: string;
  clientName?: string;
  professionalName?: string;
  location?: string;
}): Promise<BuildOpsProject> {
  const response = await fetch("/api/semse/buildops/estimates/from-tool-result", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseBuildOpsResponse<BuildOpsProject>(response);
}

export async function createBuildOpsTask(input: {
  title: string;
  description?: string;
  projectId?: string | null;
  status?: BuildOpsTaskStatus;
  priority?: BuildOpsTaskPriority;
  assigneeName?: string;
  assigneeUserId?: string;
  dueDate?: string;
  sourceTool?: string;
  evidenceRequired?: Record<string, unknown>;
}): Promise<BuildOpsTask> {
  const response = await fetch("/api/semse/buildops/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseBuildOpsResponse<BuildOpsTask>(response);
}

async function planApprovalAction(
  action: "approve" | "request-changes" | "reject" | "unapprove",
  projectId: string,
  body: Record<string, unknown>,
): Promise<PlanApprovalResult> {
  const response = await fetch(
    `/api/semse/buildops/plans/${encodeURIComponent(projectId)}/${action}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return parseBuildOpsResponse<PlanApprovalResult>(response);
}

export async function approveClientPlan(
  projectId: string,
  opts?: { reason?: string; source?: BuildOpsPlanApprovalSource },
): Promise<PlanApprovalResult> {
  return planApprovalAction("approve", projectId, { reason: opts?.reason ?? null, source: opts?.source ?? "client" });
}

export async function requestPlanChanges(
  projectId: string,
  comment: string,
): Promise<PlanApprovalResult> {
  return planApprovalAction("request-changes", projectId, { comment });
}

export async function rejectClientPlan(
  projectId: string,
  reason: string,
): Promise<PlanApprovalResult> {
  return planApprovalAction("reject", projectId, { reason });
}

export async function unapproveClientPlan(
  projectId: string,
  reason: string,
): Promise<PlanApprovalResult> {
  return planApprovalAction("unapprove", projectId, { reason });
}
