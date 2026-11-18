import { ApiError, apiFetch } from "./client";

/**
 * BO-09 location preference (docs/specs/core/geofence-policy.spec.md v0.3).
 * Behind SEMSE_GEOFENCE_POLICY_ENABLED: the API answers 404 when it is off, in
 * which case callers keep the legacy profile proximityCheckInMode (OPEN-17).
 */
export type LocationMode = "ASK" | "AUTO" | "OFF";
export type LocationPreference = {
  mode: LocationMode;
  autoStartConsent: boolean;
  effectiveMode: LocationMode;
  policyVersion: number;
};

/** Returns null when the BO-09 policy is not enabled (404). Other errors propagate. */
export async function fetchLocationPreference(): Promise<LocationPreference | null> {
  try {
    return await apiFetch<LocationPreference>("/v1/me/location-preference");
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) return null;
    throw caught;
  }
}

export async function saveLocationPreference(input: { mode: LocationMode; autoStartConsent?: boolean }): Promise<LocationPreference> {
  return apiFetch<LocationPreference>("/v1/me/location-preference", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
