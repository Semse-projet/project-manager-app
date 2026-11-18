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
