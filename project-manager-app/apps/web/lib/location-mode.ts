/**
 * OPEN-17 (docs/specs/core/geofence-policy.spec.md v0.3): with
 * SEMSE_GEOFENCE_POLICY_ENABLED on, the BO-09 LocationPreference replaces the
 * legacy profile `proximityCheckInMode`. Proximity clients keep their local
 * ask/auto/off switch, fed from the BO-09 *effective* mode — so OFF disables
 * detection, and AUTO only auto-starts while a separate, live consent exists
 * (the API already reports AUTO-without-consent as effective ASK).
 */
export type LegacyProximityMode = "ask" | "auto" | "off";
export type Bo09Mode = "ASK" | "AUTO" | "OFF";

export function proximityModeFromLocationPreference(pref: { effectiveMode: Bo09Mode; autoStartConsent: boolean }): LegacyProximityMode {
  if (pref.effectiveMode === "OFF") return "off";
  if (pref.effectiveMode === "AUTO" && pref.autoStartConsent) return "auto";
  return "ask";
}

/**
 * Outcome of reading the BO-09 preference: `ok` (200), `disabled` (404, policy
 * flag off) or `error` (anything else: network, 5xx, 401…).
 */
export type LocationPreferenceResult =
  | { kind: "ok"; pref: { effectiveMode: Bo09Mode; autoStartConsent: boolean } }
  | { kind: "disabled" }
  | { kind: "error" };

/**
 * Local proximity mode to apply. Only a 404 may fall back to the legacy profile
 * mode; any other failure fails closed to "off", so an old "auto" can never
 * start a timer while BO-09 might say OFF or ASK. Returns null when there is
 * nothing to apply (404 and no legacy profile either).
 * Mirror of apps/mobile/src/geo/locationMode.ts — keep both in sync.
 */
export function resolveProximityMode(
  result: LocationPreferenceResult,
  legacyMode: LegacyProximityMode | null,
): LegacyProximityMode | null {
  if (result.kind === "ok") return proximityModeFromLocationPreference(result.pref);
  if (result.kind === "disabled") return legacyMode;
  return "off";
}
