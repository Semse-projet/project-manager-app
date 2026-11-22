import { fetchFreeProjects, fetchJobs, fetchProximityConfig } from "../api/labor";
import { fetchProfile } from "../api/profile";
import { readLocationPreference } from "../api/locationPreference";
import { applyProximityMode } from "./applyProximityMode";
import { resolveProximityMode } from "./locationMode";
import { saveProximityConfig, saveSites, type ProximitySite } from "./siteCache";

/**
 * Best-effort refresh of the site list + proximity preference the background
 * task reads. Call on login and whenever the Timer/Settings screens gain
 * focus — there's no push-based sync, so this is a periodic pull like the
 * web tracker's own load-on-mount pattern.
 */
export async function refreshProximitySites(): Promise<void> {
  const [jobs, freeProjects, profile, proximityConfig, locationPreference] = await Promise.all([
    fetchJobs().catch(() => []),
    fetchFreeProjects().catch(() => []),
    fetchProfile().catch(() => null),
    fetchProximityConfig().catch(() => null),
    readLocationPreference(),
  ]);

  const sites: ProximitySite[] = [];
  for (const job of jobs) {
    if (typeof job.latitude === "number" && typeof job.longitude === "number") {
      sites.push({ kind: "job", id: job.id, name: job.title, latitude: job.latitude, longitude: job.longitude });
    }
  }
  for (const project of freeProjects) {
    if (typeof project.latitude === "number" && typeof project.longitude === "number") {
      sites.push({ kind: "free", id: project.id, name: project.name, latitude: project.latitude, longitude: project.longitude });
    }
  }

  await saveSites(sites);
  // OPEN-17: BO-09 (when enabled) replaces the legacy profile mode. Only a 404 falls
  // back to the profile; a failed read fails closed to "off" (resolveProximityMode).
  const nextMode = resolveProximityMode(locationPreference, profile?.proximityCheckInMode ?? null);
  if (nextMode) await applyProximityMode(nextMode);
  if (proximityConfig) await saveProximityConfig(proximityConfig);
}
