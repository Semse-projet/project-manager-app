import type {
  LiveSessionRecordView,
  LiveSessionParticipantView,
  LiveSessionMediaTokenView,
  LiveSessionTransitionAction,
} from "@semse/schemas";
import { apiFetch } from "./client";

const BASE = "/v1/prometeo/live-sessions";

export type CreateLiveSessionInput = {
  scopeType: "job" | "project";
  scopeId: string;
  purpose: "inspection" | "assist";
  idempotencyKey: string;
};

export function createLiveSession(input: CreateLiveSessionInput): Promise<LiveSessionRecordView> {
  return apiFetch<LiveSessionRecordView>(BASE, { method: "POST", body: JSON.stringify(input) });
}

export function getLiveSession(sessionId: string): Promise<LiveSessionRecordView> {
  return apiFetch<LiveSessionRecordView>(`${BASE}/${sessionId}`);
}

export function listLiveSessionParticipants(sessionId: string): Promise<LiveSessionParticipantView[]> {
  return apiFetch<LiveSessionParticipantView[]>(`${BASE}/${sessionId}/participants`);
}

export function transitionLiveSession(
  sessionId: string,
  action: LiveSessionTransitionAction,
  expectedVersion: number,
  reason?: string,
): Promise<LiveSessionRecordView> {
  return apiFetch<LiveSessionRecordView>(`${BASE}/${sessionId}/transition`, {
    method: "POST",
    body: JSON.stringify({ action, expectedVersion, reason }),
  });
}

export function markLiveSessionReady(sessionId: string, expectedVersion: number): Promise<LiveSessionRecordView> {
  return apiFetch<LiveSessionRecordView>(`${BASE}/${sessionId}/participant-ready`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion }),
  });
}

export function getLiveSessionMediaToken(sessionId: string): Promise<LiveSessionMediaTokenView> {
  return apiFetch<LiveSessionMediaTokenView>(`${BASE}/${sessionId}/media-token`);
}
