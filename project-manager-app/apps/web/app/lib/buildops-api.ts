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
  createdAt: string;
  updatedAt: string;
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
