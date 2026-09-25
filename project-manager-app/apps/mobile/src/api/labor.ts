import type {
  ActiveTimerView,
  AdminLaborOverviewView,
  FreeProjectInput as FreeProjectInputSchema,
  FreeProjectSiteView,
  FreeProjectUpdateInput,
  FreeProjectView,
  JobSiteView,
  ProximityConfigView,
  StartTimerInput,
} from "@semse/schemas";
import { apiFetch } from "./client";

// Re-exported under the names this module used before migrating onto
// @semse/schemas, so screens importing from "../api/labor" don't need to change.
export type JobSite = JobSiteView;
export type FreeProjectSite = FreeProjectSiteView;
export type FreeProject = FreeProjectView;
export type FreeProjectInput = FreeProjectInputSchema;
export type TimerPurpose = StartTimerInput["purpose"];
export type CheckInMethod = NonNullable<StartTimerInput["checkIn"]>["method"];
export type ActiveTimer = ActiveTimerView;
export type ProximityConfig = ProximityConfigView;

export async function fetchJobs(): Promise<JobSite[]> {
  return apiFetch<JobSite[]>("/v1/jobs");
}

export async function fetchFreeProjects(): Promise<FreeProjectSite[]> {
  return apiFetch<FreeProjectSite[]>("/v1/labor/free-projects");
}

export async function fetchFreeProjectList(): Promise<FreeProject[]> {
  return apiFetch<FreeProject[]>("/v1/labor/free-projects");
}

export async function createFreeProject(input: FreeProjectInput): Promise<FreeProject> {
  return apiFetch<FreeProject>("/v1/labor/free-projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateFreeProject(id: string, input: FreeProjectUpdateInput): Promise<FreeProject> {
  return apiFetch<FreeProject>(`/v1/labor/free-projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function fetchActiveTimer(): Promise<ActiveTimer> {
  return apiFetch<ActiveTimer>("/v1/labor/timer/active");
}

export async function fetchProximityConfig(): Promise<ProximityConfig> {
  return apiFetch<ProximityConfig>("/v1/labor/proximity-config");
}

export async function startTimer(input: StartTimerInput): Promise<ActiveTimer> {
  return apiFetch<ActiveTimer>("/v1/labor/timer/start", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function stopTimer(id: string): Promise<ActiveTimer> {
  return apiFetch<ActiveTimer>(`/v1/labor/timer/${encodeURIComponent(id)}/stop`, { method: "POST", body: JSON.stringify({}) });
}

export async function pauseTimer(id: string): Promise<ActiveTimer> {
  return apiFetch<ActiveTimer>(`/v1/labor/timer/${encodeURIComponent(id)}/pause`, { method: "POST" });
}

export async function resumeTimer(id: string): Promise<ActiveTimer> {
  return apiFetch<ActiveTimer>(`/v1/labor/timer/${encodeURIComponent(id)}/resume`, { method: "POST" });
}

export async function createManualEntry(input: {
  purpose: TimerPurpose;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  jobId?: string;
  freeProjectId?: string;
  notes?: string;
  clientEventId?: string;
}): Promise<NonNullable<ActiveTimer>> {
  return apiFetch<NonNullable<ActiveTimer>>("/v1/labor/entries/manual", { method: "POST", body: JSON.stringify(input) });
}

/** OPS_ADMIN only (ops:dashboard:read) — QualityGuard alerts + team weekly summary, read-only. */
export async function fetchAdminLaborOverview(): Promise<AdminLaborOverviewView> {
  return apiFetch<AdminLaborOverviewView>("/v1/labor/admin/overview");
}
