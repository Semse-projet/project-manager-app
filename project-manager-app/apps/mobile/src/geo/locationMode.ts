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
