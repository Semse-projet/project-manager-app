import { apiFetch } from "./client";

export type JobSite = {
  id: string;
  title: string;
  latitude?: number;
  longitude?: number;
};

export type FreeProjectSite = {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
};

export type FreeProject = {
  id: string;
  name: string;
  color: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  status: "active" | "archived" | "converted";
};

export type FreeProjectInput = {
  name: string;
  color?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
};

export type TimerPurpose = "personal" | "payable" | "job_linked";
export type CheckInMethod = "proximity_confirmed" | "proximity_auto";

export type ActiveTimer = {
  id: string;
  status: "running" | "paused" | "completed" | string;
  purpose: TimerPurpose;
  jobId: string | null;
  freeProjectId: string | null;
  startedAt: string;
} | null;

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

export async function updateFreeProject(id: string, input: Partial<FreeProjectInput>): Promise<FreeProject> {
  return apiFetch<FreeProject>(`/v1/labor/free-projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function fetchActiveTimer(): Promise<ActiveTimer> {
  return apiFetch<ActiveTimer>("/v1/labor/timer/active");
}

export type ProximityConfig = { radiusMeters: number; cooldownMinutes: number };

export async function fetchProximityConfig(): Promise<ProximityConfig> {
  return apiFetch<ProximityConfig>("/v1/labor/proximity-config");
}

export async function startTimer(input: {
  purpose: TimerPurpose;
  jobId?: string;
  freeProjectId?: string;
  notes?: string;
  /** Worker's position at start — never blocks the timer, only recorded for auditing. */
  checkIn?: { latitude: number; longitude: number; method?: CheckInMethod };
  clientEventId?: string;
}): Promise<ActiveTimer> {
  return apiFetch<ActiveTimer>("/v1/labor/timer/start", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function stopTimer(id: string): Promise<ActiveTimer> {
  return apiFetch<ActiveTimer>(`/v1/labor/timer/${encodeURIComponent(id)}/stop`, { method: "POST" });
}
