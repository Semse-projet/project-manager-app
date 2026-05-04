export type ClientJobsFilter =
  | "all"
  | "active"
  | "pending"
  | "posted"
  | "review"
  | "completed";

export type ClientCopilotTab = "chat" | "search" | "refresh";
export type ClientDisputesFilter = "all" | "open" | "resolved";

export const CLIENT_ROUTES = {
  dashboard: "/client/dashboard",
  jobs: "/client/jobs",
  newJob: "/client/jobs/new",
  projects: "/client/projects",
  milestones: "/client/milestones",
  documents: "/client/documents",
  payments: "/client/payments",
  disputes: "/client/disputes",
  professionals: "/client/professionals",
} as const;

export function clientJobsHref(filter?: ClientJobsFilter, query?: string) {
  const params = new URLSearchParams();
  if (filter && filter !== "all") params.set("filter", filter);
  if (query) params.set("q", query);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return `${CLIENT_ROUTES.jobs}${suffix}`;
}

export function clientPaymentsHref(input?: { tab?: "todos" | "escrow" | "pagados"; jobId?: string }) {
  const params = new URLSearchParams();
  if (input?.tab) params.set("tab", input.tab);
  if (input?.jobId) params.set("jobId", input.jobId);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return `${CLIENT_ROUTES.payments}${suffix}`;
}

export function clientProjectCopilotHref(
  projectId: string,
  input?: { tab?: ClientCopilotTab; q?: string }
) {
  const params = new URLSearchParams();
  if (input?.tab && input.tab !== "chat") params.set("tab", input.tab);
  if (input?.q) params.set("q", input.q);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return `${CLIENT_ROUTES.projects}/${encodeURIComponent(projectId)}/copilot${suffix}`;
}

export function clientDisputesHref(input?: { status?: ClientDisputesFilter; projectId?: string }) {
  const params = new URLSearchParams();
  if (input?.status && input.status !== "all") params.set("status", input.status);
  if (input?.projectId) params.set("projectId", input.projectId);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return `${CLIENT_ROUTES.disputes}${suffix}`;
}
