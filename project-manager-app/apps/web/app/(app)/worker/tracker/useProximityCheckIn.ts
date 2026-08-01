"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JobRecordView } from "../../../semse-api";
import type { FreeProjectView } from "../../labor-api";

const PROXIMITY_RADIUS_METERS = 150;
/** Don't re-prompt for the same site right after a dismiss/accept, or while lingering inside the radius. */
const COOLDOWN_MS = 20 * 60 * 1000;

export type ProximitySite = {
  kind: "job" | "free";
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type ProximityCheckIn = {
  latitude: number;
  longitude: number;
  method: "proximity_confirmed" | "proximity_auto";
};

type ProximityBannerState = {
  site: ProximitySite;
  latitude: number;
  longitude: number;
} | null;

/** "denied": the worker said no to the permission prompt (or it's blocked at
 * the OS/browser level) — proximity check-in can't work until they change it.
 * "unavailable": a transient failure (no GPS fix, timeout) that may recover
 * on the next watch tick, so it's worth wording differently. */
export type ProximityLocationError = "denied" | "unavailable" | null;

function siteKey(site: ProximitySite): string {
  return `${site.kind}:${site.id}`;
}

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const EARTH_RADIUS_METERS = 6371000;
  const toRadians = (d: number) => (d * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/**
 * Watches the worker's position (only while `enabled`) against Jobs/FreeProjects that
 * have known coordinates, and surfaces a "start the timer?" prompt (or auto-starts it)
 * when the worker is within ~150m of a site. `mode === "off"` never touches
 * navigator.geolocation at all — no permission prompt.
 */
export function useProximityCheckIn(params: {
  enabled: boolean;
  mode: "ask" | "auto" | "off";
  jobs: JobRecordView[];
  freeProjects: FreeProjectView[];
  onStart: (site: ProximitySite, checkIn: ProximityCheckIn) => void;
}) {
  const [banner, setBanner] = useState<ProximityBannerState>(null);
  const [locationError, setLocationError] = useState<ProximityLocationError>(null);
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const onStartRef = useRef(params.onStart);
  onStartRef.current = params.onStart;

  const sites = useMemo<ProximitySite[]>(() => {
    const jobSites: ProximitySite[] = params.jobs
      .filter((job): job is JobRecordView & { latitude: number; longitude: number } =>
        typeof job.latitude === "number" && typeof job.longitude === "number")
      .map((job) => ({ kind: "job", id: job.id, name: job.title, latitude: job.latitude, longitude: job.longitude }));
    const freeSites: ProximitySite[] = params.freeProjects
      .filter((project): project is FreeProjectView & { latitude: number; longitude: number } =>
        typeof project.latitude === "number" && typeof project.longitude === "number")
      .map((project) => ({ kind: "free", id: project.id, name: project.name, latitude: project.latitude, longitude: project.longitude }));
    return [...jobSites, ...freeSites];
  }, [params.jobs, params.freeProjects]);

  useEffect(() => {
    setLocationError(null);
    if (!params.enabled || params.mode === "off" || sites.length === 0) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocationError(null);
        const here = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        const nearby = sites.find((site) => {
          const cooledAt = cooldownRef.current.get(siteKey(site));
          if (cooledAt && Date.now() - cooledAt < COOLDOWN_MS) return false;
          return distanceMeters(here, site) <= PROXIMITY_RADIUS_METERS;
        });
        if (!nearby) return;

        cooldownRef.current.set(siteKey(nearby), Date.now());
        if (params.mode === "auto") {
          onStartRef.current(nearby, { ...here, method: "proximity_auto" });
          return;
        }
        setBanner({ site: nearby, ...here });
      },
      (positionError) => {
        // Proximity check-in is a convenience, so a failure never blocks the
        // tracker — but staying completely silent left workers with no idea
        // why the prompt never showed up. code 1 = PERMISSION_DENIED; treat
        // everything else (2 = POSITION_UNAVAILABLE, 3 = TIMEOUT) as transient.
        setLocationError(positionError.code === 1 ? "denied" : "unavailable");
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [params.enabled, params.mode, sites]);

  const acceptBanner = useCallback(() => {
    if (!banner) return;
    onStartRef.current(banner.site, { latitude: banner.latitude, longitude: banner.longitude, method: "proximity_confirmed" });
    setBanner(null);
  }, [banner]);

  const dismissBanner = useCallback(() => {
    if (banner) cooldownRef.current.set(siteKey(banner.site), Date.now());
    setBanner(null);
  }, [banner]);

  return { banner, acceptBanner, dismissBanner, locationError };
}
