import { ApiError, apiFetch } from "./client";

/**
 * OPEN-18 (docs/specs/core/worksite-location-binding.spec.md, W-07): linked worksites
 * the person can detect, and server decisions for arrivals. Behind
 * SEMSE_WORKSITE_BINDING_ENABLED: 404 while it is off, so callers keep the legacy mode.
 */
// Contrato único de `GET /v1/me/geofence-sites` (el mismo que usan la API y la web).
import type { GeofenceSiteView } from "@semse/schemas";
export type GeofenceSite = GeofenceSiteView;

export type GeofenceDecisionView = {
  id?: string;
  eventId: string;
  decision: string;
  reason: string;
};

/** null when worksite binding is not enabled on the server (404). Other errors propagate. */
export async function fetchGeofenceSites(): Promise<GeofenceSite[] | null> {
  try {
    return await apiFetch<GeofenceSite[]>("/v1/me/geofence-sites");
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) return null;
    throw caught;
  }
}

/** Reports an arrival (no coordinates — only the site and the accuracy) and returns the server decision. */
export async function reportGeofenceArrival(input: {
  eventId: string;
  site: { kind: "JOB" | "FREE_PROJECT"; id: string };
  occurredAt: string;
  accuracyMeters?: number;
}): Promise<GeofenceDecisionView> {
  return apiFetch<GeofenceDecisionView>("/v1/me/geofence-events", {
    method: "POST",
    body: JSON.stringify({ type: "ARRIVAL", ...input }),
  });
}
