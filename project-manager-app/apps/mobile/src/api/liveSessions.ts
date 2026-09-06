import { apiFetch } from "./client";

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
