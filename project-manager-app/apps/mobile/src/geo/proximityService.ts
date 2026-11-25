import { startTimer } from "../api/labor";
import { reportGeofenceArrival } from "../api/geofence";
import { proximityActionForDecision } from "./geofenceDecision";
import { presentProximityNotification, PROXIMITY_CATEGORY } from "../notifications/notifications";
import { isCoolingDown, markCooldown } from "./cooldownStore";
import { distanceMeters, isValidCoordinate } from "./distance";
import { loadProximityConfig, loadProximityMode, loadSites, type ProximitySite } from "./siteCache";

/**
 * OPEN-18: on a linked worksite the prompt cooldown only starts after a visible action
 * (prompt or start). An IGNORE does not start it; this short limit only avoids reporting an
 * arrival on every location update.
 */
export const SERVER_EVALUATION_THROTTLE_MINUTES = 1;

function siteKey(site: ProximitySite): string {
  return `${site.kind}:${site.id}`;
}

async function askToStart(site: ProximitySite, point: { latitude: number; longitude: number }): Promise<void> {
  await presentProximityNotification({
    title: "¿Iniciar el reloj?",
    body: `Estás en "${site.name}".`,
    data: {
      kind: "ask",
      siteKind: site.kind,
      siteId: site.id,
      siteName: site.name,
      latitude: point.latitude,
      longitude: point.longitude,
    },
    categoryIdentifier: PROXIMITY_CATEGORY,
  });
}

/**
 * Called on every background (or foreground) location update. Never throws —
 * a proximity miss/API failure should not crash the location task.
 */
export async function evaluateLocation(point: { latitude: number; longitude: number; accuracy?: number | null }): Promise<void> {
  if (!isValidCoordinate(point.latitude, point.longitude)) return;

  const mode = await loadProximityMode();
  if (mode === "off") return;

  const sites = await loadSites();
  if (sites.length === 0) return;

  const { radiusMeters, cooldownMinutes } = await loadProximityConfig();
  const nearby = sites.find((site) => distanceMeters(point, site) <= (site.radiusMeters ?? radiusMeters));
  if (!nearby) return;

  const key = siteKey(nearby);
  if (await isCoolingDown(key, cooldownMinutes)) return;

  try {
    // OPEN-18: on a linked worksite the server decides. The app only auto-starts with an
    // AUTO_START_ALLOWED decision (and passes its id); a failed call never auto-starts.
    let action: "auto" | "ask" | "none" | "legacy" = "legacy";
    let geofenceEventId: string | undefined;
    if (nearby.bound) {
      const evaluationKey = `eval:${key}`;
      if (await isCoolingDown(evaluationKey, SERVER_EVALUATION_THROTTLE_MINUTES)) return;
      await markCooldown(evaluationKey);
      try {
        const decision = await reportGeofenceArrival({
          eventId: `arrival-${key}-${Date.now()}`,
          site: { kind: nearby.kind === "job" ? "JOB" : "FREE_PROJECT", id: nearby.id },
          occurredAt: new Date().toISOString(),
          accuracyMeters: typeof point.accuracy === "number" && Number.isFinite(point.accuracy) ? point.accuracy : undefined,
        });
        action = proximityActionForDecision(decision.decision);
        geofenceEventId = decision.id;
        if (action === "auto" && !geofenceEventId) action = "ask";
      } catch {
        action = "ask";
      }
      // IGNORE: no prompt, and no prompt cooldown either.
      if (action === "none") return;
    }

    // A visible action follows: start the prompt cooldown.
    await markCooldown(key);

    if (action === "auto" || (action === "legacy" && mode === "auto")) {
      try {
        await startTimer({
          purpose: nearby.kind === "job" ? "job_linked" : "payable",
          jobId: nearby.kind === "job" ? nearby.id : undefined,
          freeProjectId: nearby.kind === "free" ? nearby.id : undefined,
          checkIn: { latitude: point.latitude, longitude: point.longitude, method: "proximity_auto" },
          clientEventId: `proximity-auto-${key}-${Date.now()}`,
          ...(geofenceEventId ? { geofenceEventId } : {}),
        });
      } catch (startError) {
        // AC-08: the server rejected the automatic start (409 auto_start_not_authorized:
        // consent revoked, decision consumed or expired) or it could not be completed. Never
        // retry it as an automatic start: ask, so only an explicit tap sends proximity_confirmed.
        console.warn("[proximity] automatic start not completed; asking for confirmation", startError);
        await askToStart(nearby, point);
        return;
      }
      await presentProximityNotification({
        title: "Reloj iniciado",
        body: `Detectamos que llegaste a "${nearby.name}" e iniciamos el reloj automáticamente.`,
        data: { kind: "auto-started" },
      });
    } else {
      await askToStart(nearby, point);
    }
  } catch (error) {
    console.warn("[proximity] failed to act on proximity match", error);
  }
}
