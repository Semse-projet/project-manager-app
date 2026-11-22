import type { ProximityCheckInMode } from "../api/profile";
import { stopProximityTracking } from "./backgroundLocation";
import { saveProximityMode } from "./siteCache";

/**
 * Single place where the local proximity mode (read by the background task) is
 * written. OFF also stops the background location subscription: turning
 * detection off must stop the OS from delivering coordinates, not only stop
 * acting on them. Re-enabling never starts tracking implicitly; that stays on
 * the explicit permission flow in the Timer screen.
 */
export async function applyProximityMode(mode: ProximityCheckInMode): Promise<void> {
  await saveProximityMode(mode);
  if (mode === "off") await stopProximityTracking().catch(() => undefined);
}
