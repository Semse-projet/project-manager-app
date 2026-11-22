import type { ProximityCheckInMode } from "../api/profile";
import type { LocationPreference } from "../api/locationPreference";

/**
 * OPEN-17: with the BO-09 policy enabled its *effective* mode drives the local
 * proximity switch. OFF disables detection; AUTO only auto-starts while a live,
 * separate consent exists (AUTO without consent behaves as ASK).
 * Mirror of apps/web/lib/location-mode.ts — keep both in sync.
 */
export function proximityModeFromLocationPreference(
  pref: Pick<LocationPreference, "effectiveMode" | "autoStartConsent">,
): ProximityCheckInMode {
  if (pref.effectiveMode === "OFF") return "off";
  if (pref.effectiveMode === "AUTO" && pref.autoStartConsent) return "auto";
  return "ask";
}

/**
 * Outcome of reading the BO-09 preference: `ok` (200), `disabled` (404, policy
 * flag off) or `error` (anything else: network, 5xx, 401…).
 */
export type LocationPreferenceResult =
  | { kind: "ok"; pref: LocationPreference }
  | { kind: "disabled" }
  | { kind: "error"; message: string };

/**
 * Local proximity mode to apply. Only a 404 may fall back to the legacy profile
 * mode; any other failure fails closed to "off", so an old "auto" can never
 * start a timer while BO-09 might say OFF or ASK. Returns null when there is
 * nothing to apply (404 and no legacy profile either).
 * Mirror of apps/web/lib/location-mode.ts — keep both in sync.
 */
export function resolveProximityMode(
  result: LocationPreferenceResult,
  legacyMode: ProximityCheckInMode | null,
): ProximityCheckInMode | null {
  if (result.kind === "ok") return proximityModeFromLocationPreference(result.pref);
  if (result.kind === "disabled") return legacyMode;
  return "off";
}
