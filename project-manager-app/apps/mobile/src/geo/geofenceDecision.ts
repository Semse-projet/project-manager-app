/**
 * OPEN-18 (docs/specs/core/worksite-location-binding.spec.md, W-07). Mirror of
 * apps/web/lib/geofence-decision.ts: the server is the authority — the app only
 * auto-starts on AUTO_START_ALLOWED (passing its id as `geofenceEventId`);
 * PROMPT/MANUAL_ONLY ask the person; anything else does nothing. Decide by
 * `decision`, never by the `reason` text.
 */
export type ProximityAction = "auto" | "ask" | "none";

export function proximityActionForDecision(decision: string | null | undefined): ProximityAction {
  if (decision === "AUTO_START_ALLOWED") return "auto";
  if (decision === "PROMPT" || decision === "MANUAL_ONLY") return "ask";
  return "none";
}
