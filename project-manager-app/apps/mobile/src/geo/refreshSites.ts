import { fetchFreeProjects, fetchJobs, fetchProximityConfig } from "../api/labor";
import { fetchProfile } from "../api/profile";
import { fetchLocationPreference } from "../api/locationPreference";
import { fetchGeofenceSites } from "../api/geofence";
import { proximityModeFromLocationPreference } from "./locationMode";
import { saveProximityConfig, saveProximityMode, saveSites, type ProximitySite } from "./siteCache";

/**
 * Best-effort refresh of the site list + proximity preference the background
 * task reads. Call on login and whenever the Timer/Settings screens gain
 * focus — there's no push-based sync, so this is a periodic pull like the
 * web tracker's own load-on-mount pattern.
 */
export async function refreshProximitySites(): Promise<void> {
  const [jobs, freeProjects, profile, proximityConfig, locationPreference, geofenceSites] = await Promise.all([
    fetchJobs().catch(() => []),
    fetchFreeProjects().catch(() => []),
    fetchProfile().catch(() => null),
    fetchProximityConfig().catch(() => null),
    fetchLocationPreference().catch(() => null),
    // OPEN-18: 200 = the server decides each arrival at linked worksites; 404/error = legacy mode.
    fetchGeofenceSites().catch(() => null),
  ]);

  const sites: ProximitySite[] = [];
  if (geofenceSites) {
    for (const site of geofenceSites) {
      sites.push({
        kind: site.kind === "JOB" ? "job" : "free",
        id: site.targetId,
        name: site.worksiteName,
        latitude: site.latitude,
        longitude: site.longitude,
        radiusMeters: site.radiusMeters ?? undefined,
        bound: true,
      });
    }
  }
  for (const job of geofenceSites ? [] : jobs) {
    if (typeof job.latitude === "number" && typeof job.longitude === "number") {
      sites.push({ kind: "job", id: job.id, name: job.title, latitude: job.latitude, longitude: job.longitude });
    }
  }
  for (const project of geofenceSites ? [] : freeProjects) {
    if (typeof project.latitude === "number" && typeof project.longitude === "number") {
      sites.push({ kind: "free", id: project.id, name: project.name, latitude: project.latitude, longitude: project.longitude });
    }
  }

  await saveSites(sites);
  // OPEN-17: BO-09 (when enabled) replaces the legacy profile mode.
  if (locationPreference) await saveProximityMode(proximityModeFromLocationPreference(locationPreference));
  else if (profile) await saveProximityMode(profile.proximityCheckInMode);
  if (proximityConfig) await saveProximityConfig(proximityConfig);
}
