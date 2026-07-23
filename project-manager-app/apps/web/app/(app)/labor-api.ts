// Labor Engine — client-side API functions

export class LaborApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "LaborApiError";
  }
}

async function fetchLabor<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new LaborApiError(err?.error?.message ?? `Labor API error ${res.status}`, res.status);
  }
  const json = await res.json() as { data: T };
  return json.data;
}

async function mutateLabor<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  return fetchLabor<T>(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type TimeEntryView = {
  id: string;
  mode: "realtime" | "manual";
  purpose: "personal" | "payable" | "job_linked";
  jobId: string | null;
  freeProjectId: string | null;
  status: "running" | "paused" | "completed" | "pending_review" | "approved" | "deleted";
  startedAt: string;
  endedAt: string | null;
  resumedAt: string | null;
  pausedAt: string | null;
  breakMinutes: number;
  durationMinutes: number | null;
  accumulatedSeconds: number;
  hourlyRate: number | null;
  currency: string;
  location: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FreeProjectView = {
  id: string;
  createdBy: string;
  name: string;
  color: string;
  location: string | null;
  description: string | null;
  status: "active" | "archived" | "converted";
  convertedJobId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WeeklySummaryView = {
  period: "week";
  from: string;
  to: string;
  totalMinutes: number;
  totalHours: number;
  totalEntries: number;
  byDay: { date: string; minutes: number }[];
  previousWeekMinutes: number;
  changePercent: number | null;
};

export type MonthlySummaryView = {
  period: "month";
  from: string;
  to: string;
  totalMinutes: number;
  totalHours: number;
  totalEntries: number;
  byDay: { date: string; minutes: number }[];
};

export type LaborChatResponse = {
  threadId: string;
  response: string;
  provider: string;
  model: string;
  mode: "runtime" | "fallback";
  timestamp: string;
  errorMessage?: string;
};

// ── Free Projects ─────────────────────────────────────────────────────────────

export async function fetchFreeProjects(): Promise<FreeProjectView[]> {
  return fetchLabor<FreeProjectView[]>("/api/semse/labor/free-projects");
}

export async function createFreeProject(input: {
  name: string; color?: string; location?: string; description?: string;
}): Promise<FreeProjectView> {
  return mutateLabor<FreeProjectView>("/api/semse/labor/free-projects", input);
}

export async function updateFreeProject(id: string, input: Partial<FreeProjectView>): Promise<FreeProjectView> {
  return mutateLabor<FreeProjectView>(`/api/semse/labor/free-projects/${encodeURIComponent(id)}`, input, "PATCH");
}

export async function archiveFreeProject(id: string): Promise<FreeProjectView> {
  return mutateLabor<FreeProjectView>(`/api/semse/labor/free-projects/${encodeURIComponent(id)}`, undefined, "DELETE");
}

export async function convertFreeProjectToJob(id: string, jobId: string): Promise<FreeProjectView> {
  return mutateLabor<FreeProjectView>(`/api/semse/labor/free-projects/${encodeURIComponent(id)}/convert`, { jobId });
}

// ── Timer ─────────────────────────────────────────────────────────────────────

export async function fetchActiveTimer(): Promise<TimeEntryView | null> {
  return fetchLabor<TimeEntryView | null>("/api/semse/labor/timer/active");
}

export async function startLaborTimer(input: {
  purpose: "personal" | "payable" | "job_linked";
  jobId?: string;
  freeProjectId?: string;
  notes?: string;
  /** Idempotency key (Time Tracker local queue event id) — lets a retried sync resolve to the same entry instead of creating a duplicate. */
  clientEventId?: string;
}): Promise<TimeEntryView> {
  return mutateLabor<TimeEntryView>("/api/semse/labor/timer/start", input);
}

export async function pauseLaborTimer(id: string): Promise<TimeEntryView> {
  return mutateLabor<TimeEntryView>(`/api/semse/labor/timer/${encodeURIComponent(id)}/pause`);
}

export async function resumeLaborTimer(id: string): Promise<TimeEntryView> {
  return mutateLabor<TimeEntryView>(`/api/semse/labor/timer/${encodeURIComponent(id)}/resume`);
}

export async function stopLaborTimer(id: string, notes?: string): Promise<TimeEntryView> {
  return mutateLabor<TimeEntryView>(`/api/semse/labor/timer/${encodeURIComponent(id)}/stop`, { notes });
}

export async function updateLaborTimerNotes(id: string, notes: string): Promise<TimeEntryView> {
  return mutateLabor<TimeEntryView>(`/api/semse/labor/timer/${encodeURIComponent(id)}/notes`, { notes }, "PATCH");
}

// ── Manual entries ────────────────────────────────────────────────────────────

export async function createManualEntry(input: {
  purpose: "personal" | "payable" | "job_linked";
  jobId?: string;
  freeProjectId?: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  hourlyRate?: number;
  currency?: string;
  location?: string;
  notes?: string;
  /** Idempotency key (Time Tracker local queue event id) — lets a retried sync resolve to the same entry instead of creating a duplicate. */
  clientEventId?: string;
}): Promise<TimeEntryView> {
  return mutateLabor<TimeEntryView>("/api/semse/labor/entries/manual", input);
}

export async function fetchLaborEntries(params?: {
  range?: "week" | "month" | "all";
  jobId?: string;
  freeProjectId?: string;
  purpose?: string;
  limit?: number;
}): Promise<TimeEntryView[]> {
  const qs = new URLSearchParams();
  if (params?.range) qs.set("range", params.range);
  if (params?.jobId) qs.set("jobId", params.jobId);
  if (params?.freeProjectId) qs.set("freeProjectId", params.freeProjectId);
  if (params?.purpose) qs.set("purpose", params.purpose);
  if (params?.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  return fetchLabor<TimeEntryView[]>(`/api/semse/labor/entries${q ? `?${q}` : ""}`);
}

// ── Summaries ─────────────────────────────────────────────────────────────────

export async function fetchWeeklySummary(weekOffset = 0): Promise<WeeklySummaryView> {
  return fetchLabor<WeeklySummaryView>(`/api/semse/labor/summary/week?offset=${weekOffset}`);
}

export async function fetchMonthlySummary(): Promise<MonthlySummaryView> {
  return fetchLabor<MonthlySummaryView>("/api/semse/labor/summary/month");
}

// ── Chat (Cronos, vía Ollama local) ────────────────────────────────────────────

export async function sendLaborChatMessage(message: string, threadId?: string): Promise<LaborChatResponse> {
  return mutateLabor<LaborChatResponse>("/api/semse/labor/chat", { message, threadId });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmtSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

export function elapsedSeconds(entry: TimeEntryView): number {
  if (entry.status !== "running") return entry.accumulatedSeconds;
  const anchor = entry.resumedAt ?? entry.startedAt;
  if (!anchor) return entry.accumulatedSeconds;
  return entry.accumulatedSeconds + Math.max(0, Math.floor((Date.now() - new Date(anchor).getTime()) / 1000));
}

export const PURPOSE_LABELS: Record<string, string> = {
  personal: "Solo calcular mis horas",
  payable: "Horas para posible pago",
  job_linked: "Asociar a job/proyecto formal",
};

export const PURPOSE_COLORS: Record<string, string> = {
  personal: "#6b7280",
  payable: "#f59e0b",
  job_linked: "#3b82f6",
};
