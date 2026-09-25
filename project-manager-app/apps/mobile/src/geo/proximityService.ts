import { startTimer } from "../api/labor";
import { presentProximityNotification, PROXIMITY_CATEGORY } from "../notifications/notifications";
import { isCoolingDown, markCooldown } from "./cooldownStore";
import { distanceMeters, isValidCoordinate } from "./distance";
import { loadProximityConfig, loadProximityMode, loadSites, type ProximitySite } from "./siteCache";

function siteKey(site: ProximitySite): string {
  return `${site.kind}:${site.id}`;
}

/**
 * Called on every background (or foreground) location update. Never throws —
 * a proximity miss/API failure should not crash the location task.
 */
export async function evaluateLocation(point: { latitude: number; longitude: number }): Promise<void> {
  if (!isValidCoordinate(point.latitude, point.longitude)) return;

  const mode = await loadProximityMode();
  if (mode === "off") return;

  const sites = await loadSites();
  if (sites.length === 0) return;

  const { radiusMeters, cooldownMinutes } = await loadProximityConfig();
  const nearby = sites.find((site) => distanceMeters(point, site) <= radiusMeters);
  if (!nearby) return;

  const key = siteKey(nearby);
  if (await isCoolingDown(key, cooldownMinutes)) return;
  await markCooldown(key);

  try {
    if (mode === "auto") {
      await startTimer({
        purpose: nearby.kind === "job" ? "job_linked" : "payable",
        jobId: nearby.kind === "job" ? nearby.id : undefined,
        freeProjectId: nearby.kind === "free" ? nearby.id : undefined,
        checkIn: { latitude: point.latitude, longitude: point.longitude, method: "proximity_auto" },
        clientEventId: `proximity-auto-${key}-${Date.now()}`,
      });
      await presentProximityNotification({
        title: "Reloj iniciado",
        body: `Detectamos que llegaste a "${nearby.name}" e iniciamos el reloj automáticamente.`,
        data: { kind: "auto-started" },
      });
    } else {
      await presentProximityNotification({
        title: "¿Iniciar el reloj?",
        body: `Estás en "${nearby.name}".`,
        data: {
          kind: "ask",
          siteKind: nearby.kind,
          siteId: nearby.id,
          siteName: nearby.name,
          latitude: point.latitude,
          longitude: point.longitude,
        },
        categoryIdentifier: PROXIMITY_CATEGORY,
      });
    }
  } catch (error) {
    console.warn("[proximity] failed to act on proximity match", error);
  }
}
