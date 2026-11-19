/**
 * Client-side wrappers for the crews/worksites (BO-07) and location-preference
 * (BO-09) BFF routes (apps/web/app/api/semse/{organizations,me}/**). Components
 * call these functions; they never build NestJS URLs themselves.
 */

/** Error carrying the HTTP status, so screens can tell "feature off" (404) from "forbidden" (403). */
export class SurfaceApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "SurfaceApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init });
  const payload = (await response.json().catch(() => ({}))) as { data?: T; error?: { message?: string } };
  if (!response.ok) {
    throw new SurfaceApiError(payload.error?.message ?? `La solicitud falló (${response.status})`, response.status);
  }
  return payload.data as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });

const seg = encodeURIComponent;

/* ─────────────────────── Crews & worksites (BO-07) ─────────────────────── */
// Spec: docs/specs/core/crews-worksites.spec.md (APPROVED 2026-11-12).

export type OrgSummary = { id: string; name?: string } & Record<string, unknown>;
export type OrgMember = { userId: string; orgId: string; roleId: string; createdAt: string };
export type Worksite = { worksiteId: string; name: string; address: string | null; status: string };
export type CrewMember = { userId: string; addedAt: string };
export type OrgWorker = { userId: string; since: string };
export type Crew = {
  crewId: string;
  orgId: string;
  name: string;
  supervisorUserId: string;
  worksiteId: string | null;
  status: string;
  /** Active members (spec AC-10). Absent on API versions older than v0.3 of the spec. */
  members?: CrewMember[];
};

const orgBase = (orgId: string) => `/api/semse/organizations/${seg(orgId)}`;

export const fetchMyOrganizations = () => request<OrgSummary[]>("/api/semse/organizations");
export const fetchOrgMembers = (orgId: string) => request<OrgMember[]>(`${orgBase(orgId)}/members`);
export const fetchOrgWorkers = (orgId: string) => request<OrgWorker[]>(`${orgBase(orgId)}/workers`);

export const fetchWorksites = (orgId: string) => request<Worksite[]>(`${orgBase(orgId)}/worksites`);
export const createWorksite = (orgId: string, input: { name: string; address?: string }) =>
  post<Worksite>(`${orgBase(orgId)}/worksites`, input);

export const fetchOrgCrews = (orgId: string) => request<Crew[]>(`${orgBase(orgId)}/crews`);
export const createCrew = (orgId: string, input: { name: string; supervisorUserId: string; worksiteId?: string }) =>
  post<Crew>(`${orgBase(orgId)}/crews`, input);

export const addCrewMember = (orgId: string, crewId: string, userId: string) =>
  post<{ crewId: string; userId: string; status: string }>(`${orgBase(orgId)}/crews/${seg(crewId)}/members`, { userId });

export const removeCrewMember = (orgId: string, crewId: string, userId: string) =>
  post<{ crewId: string; userId: string; status: string }>(`${orgBase(orgId)}/crews/${seg(crewId)}/members/remove`, { userId });

export const archiveCrew = (orgId: string, crewId: string) =>
  post<{ status: string }>(`${orgBase(orgId)}/crews/${seg(crewId)}/archive`);

/* ─────────────────────── Location preference (BO-09) ─────────────────────── */
// Spec: docs/specs/core/geofence-policy.spec.md v0.2.

export type LocationMode = "ASK" | "AUTO" | "OFF";
export type LocationPreference = {
  mode: LocationMode;
  autoStartConsent: boolean;
  /** AUTO without a live consent behaves as ASK. */
  effectiveMode: LocationMode;
  policyVersion: number;
};
export type GeofenceDecision = "PROMPT" | "AUTO_START_ALLOWED" | "MANUAL_ONLY" | "LEAVE_PROMPT" | "EXCEPTION" | "IGNORE";
export type GeofenceEventView = {
  eventId: string;
  type: "ARRIVAL" | "LEAVE" | "OFF_SITE_AT_SHIFT";
  worksiteId: string | null;
  decision: GeofenceDecision;
  reason: string;
  mode: LocationMode;
  policyVersion: number;
  accuracy: "GOOD" | "POOR" | "UNKNOWN";
  occurredAt: string;
  decidedAt: string;
};

export const fetchLocationPreference = () => request<LocationPreference>("/api/semse/me/location-preference");

export const saveLocationPreference = (input: { mode: LocationMode; autoStartConsent?: boolean }) =>
  request<LocationPreference>("/api/semse/me/location-preference", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });

export const fetchMyGeofenceEvents = () => request<GeofenceEventView[]>("/api/semse/me/geofence-events");
