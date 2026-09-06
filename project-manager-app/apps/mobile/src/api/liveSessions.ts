import { apiFetch } from "./client";

export type PrometeoSuggestedAction = { action: string; description: string };
export type PrometeoResource = { id: string | null; type: string; data: unknown | null };
export type PrometeoContext = {
  module: string;
  resource: PrometeoResource;
  permissions: string[];
  suggestedActions: PrometeoSuggestedAction[];
  confidence: number;
};
export type PrometeoMessageResponse = {
  sessionId: string;
  response: string;
  suggestedActions: PrometeoSuggestedAction[];
  requiresWorkspace: boolean;
  missionSuggestion?: { title: string; type: string; reason: string };
};

export type LiveSessionSnapshot = {
  id: string;
  scopeType: "job" | "project";
  scopeId: string;
  purpose: "inspection" | "assist";
  status: string;
  version: number;
  createdAt?: string;
};

export type LiveSessionMediaToken = {
  serverUrl: string;
  roomName: string;
  participantIdentity: string;
  token: string;
};

export type MobileTask = { id: string; jobId: string; title: string; description?: string; status: "pending" | "in_progress" | "done" | "blocked"; priority?: string; dueDate?: string };
export type MobileNotification = { id: string; title?: string; message?: string; body?: string; readAt?: string | null; createdAt?: string };

export async function createLiveSession(input: {
  scopeType: "job" | "project";
  scopeId: string;
  purpose: "inspection" | "assist";
  idempotencyKey: string;
}): Promise<LiveSessionSnapshot> {
  return apiFetch<LiveSessionSnapshot>("/v1/prometeo/live-sessions", {
    method: "POST",
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
  });
}

export async function getLiveSession(sessionId: string): Promise<LiveSessionSnapshot> {
  return apiFetch<LiveSessionSnapshot>(`/v1/prometeo/live-sessions/${encodeURIComponent(sessionId)}`);
}

export async function getLiveSessionMediaToken(sessionId: string): Promise<LiveSessionMediaToken> {
  return apiFetch<LiveSessionMediaToken>(
    `/v1/prometeo/live-sessions/${encodeURIComponent(sessionId)}/media-token`,
  );
}

export async function transitionLiveSession(
  sessionId: string,
  input: { action: "accept" | "pause" | "resume" | "end" | "cancel"; expectedVersion: number; reason?: string },
): Promise<LiveSessionSnapshot> {
  return apiFetch<LiveSessionSnapshot>(
    `/v1/prometeo/live-sessions/${encodeURIComponent(sessionId)}/transition`,
    { method: "POST", body: JSON.stringify(input), headers: { "content-type": "application/json" } },
  );
}

export async function askPrometeo(input: { message: string; threadId?: string; agentId?: string }) {
  return apiFetch<{ reply?: string; message?: string; threadId?: string }>("/v1/agents/chat", {
    method: "POST",
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
  });
}

export async function fetchPrometeoContext(): Promise<PrometeoContext> {
  return apiFetch<PrometeoContext>("/v1/prometeo/copilot/context", {
    method: "POST",
    body: JSON.stringify({ currentUrl: "/mobile/worker/prometeo" }),
  });
}

export async function sendPrometeoCopilotMessage(input: {
  message: string;
  sessionId?: string;
  context?: { module: string; resource?: PrometeoResource; permissions?: string[] };
}): Promise<PrometeoMessageResponse> {
  return apiFetch<PrometeoMessageResponse>("/v1/prometeo/copilot/message", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function executePrometeoAction(input: {
  action: string;
  targetResource: { resourceId: string; resourceType: string };
}): Promise<{ actionId: string; status: "pending" | "completed" | "failed"; result: unknown; requiresWorkspace: boolean }> {
  return apiFetch("/v1/prometeo/copilot/action/execute", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchMobileTasks(status?: string) {
  return apiFetch<MobileTask[]>(`/v1/tasks${status ? `?status=${encodeURIComponent(status)}` : ""}`);
}

export async function updateMobileTask(taskId: string, status: MobileTask["status"]) {
  return apiFetch<MobileTask>(`/v1/tasks/${encodeURIComponent(taskId)}/status`, { method: "PATCH", body: JSON.stringify({ status }), headers: { "content-type": "application/json" } });
}

export async function fetchMobileNotifications() {
  const result = await apiFetch<MobileNotification[] | { items?: MobileNotification[] }>("/v1/notifications?limit=50");
  return Array.isArray(result) ? result : result.items ?? [];
}

export async function markMobileNotificationRead(notificationId: string) {
  return apiFetch<MobileNotification>(`/v1/notifications/${encodeURIComponent(notificationId)}/read`, { method: "POST" });
}
