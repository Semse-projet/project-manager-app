"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JobRecordView } from "../../../semse-api";
import type { FreeProjectView } from "../../labor-api";
import type { ProximityAction } from "../../../../lib/geofence-decision";

/** Fallback used until the org's configured value loads (or if it never does). */
const DEFAULT_PROXIMITY_RADIUS_METERS = 150;
/** Don't re-prompt for the same site right after a dismiss/accept, or while lingering inside the radius. */
const DEFAULT_COOLDOWN_MS = 20 * 60 * 1000;
/**
 * OPEN-18: con el servidor como autoridad, el enfriamiento de avisos solo empieza tras una
 * acción visible (aviso o inicio). Un IGNORE no lo activa; este límite corto solo evita
 * enviar una llegada en cada lectura del GPS.
 */
export const SERVER_EVALUATION_THROTTLE_MS = 60 * 1000;

export type ProximitySite = {
  kind: "job" | "free";
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** OPEN-18: radio de la OBRA vinculada; si falta, se usa el radio de la Org. */
  radiusMeters?: number;
};

export type ProximityCheckIn = {
  latitude: number;
  longitude: number;
  method: "proximity_confirmed" | "proximity_auto";
  /** OPEN-18: decisión AUTO_START_ALLOWED del servidor que autoriza el inicio `proximity_auto`. */
  geofenceEventId?: string;
};

/** OPEN-18: respuesta del servidor a una llegada (ver lib/geofence-decision.ts). */
export type ArrivalOutcome = { action: ProximityAction; geofenceEventId?: string };

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
  /**
   * OPEN-18 (W-07): obras vinculadas del servidor (`GET /v1/me/geofence-sites`). Si llega
   * (no null), sustituye a los jobs/proyectos locales y cada llegada se evalúa en el
   * servidor con `evaluateArrival`: el cliente solo auto-inicia si el servidor lo autoriza.
   */
  serverSites?: ProximitySite[] | null;
  evaluateArrival?: (site: ProximitySite, here: { latitude: number; longitude: number; accuracyMeters?: number }) => Promise<ArrivalOutcome>;
  onStart: (site: ProximitySite, checkIn: ProximityCheckIn) => void;
  /** Org-configured overrides (from GET /v1/labor/proximity-config) — fall
   * back to the hardcoded defaults until that loads, or if it never does. */
  radiusMeters?: number;
  cooldownMs?: number;
}) {
  const [banner, setBanner] = useState<ProximityBannerState>(null);
  const [locationError, setLocationError] = useState<ProximityLocationError>(null);
  const [isWatching, setIsWatching] = useState(false);
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const evaluatedRef = useRef<Map<string, number>>(new Map());
  const onStartRef = useRef(params.onStart);
  onStartRef.current = params.onStart;
  const evaluateRef = useRef(params.evaluateArrival);
  evaluateRef.current = params.evaluateArrival;
  const serverAuthority = params.serverSites != null && !!params.evaluateArrival;
  const radiusMeters = params.radiusMeters ?? DEFAULT_PROXIMITY_RADIUS_METERS;
  const cooldownMs = params.cooldownMs ?? DEFAULT_COOLDOWN_MS;

  const sites = useMemo<ProximitySite[]>(() => {
    if (params.serverSites != null) return params.serverSites;
    const jobSites: ProximitySite[] = params.jobs
      .filter((job): job is JobRecordView & { latitude: number; longitude: number } =>
        typeof job.latitude === "number" && typeof job.longitude === "number")
      .map((job) => ({ kind: "job", id: job.id, name: job.title, latitude: job.latitude, longitude: job.longitude }));
    const freeSites: ProximitySite[] = params.freeProjects
      .filter((project): project is FreeProjectView & { latitude: number; longitude: number } =>
        typeof project.latitude === "number" && typeof project.longitude === "number")
      .map((project) => ({ kind: "free", id: project.id, name: project.name, latitude: project.latitude, longitude: project.longitude }));
    return [...jobSites, ...freeSites];
  }, [params.jobs, params.freeProjects, params.serverSites]);

  useEffect(() => {
    setLocationError(null);
    if (!params.enabled || params.mode === "off" || sites.length === 0) {
      setIsWatching(false);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setIsWatching(false);
      return;
    }
    setIsWatching(true);
    // Una respuesta del servidor que llega después de limpiar este efecto (salir del reloj,
    // cambiar de pestaña, apagar la detección) se descarta: no puede iniciar ni avisar.
    let active = true;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocationError(null);
        const here = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        const nearby = sites.find((site) => {
          const cooledAt = cooldownRef.current.get(siteKey(site));
          if (cooledAt && Date.now() - cooledAt < cooldownMs) return false;
          return distanceMeters(here, site) <= (site.radiusMeters ?? radiusMeters);
        });
        if (!nearby) return;

        if (serverAuthority && evaluateRef.current) {
          const key = siteKey(nearby);
          const lastEvaluated = evaluatedRef.current.get(key);
          if (lastEvaluated && Date.now() - lastEvaluated < SERVER_EVALUATION_THROTTLE_MS) return;
          evaluatedRef.current.set(key, Date.now());
          // El servidor decide (precisión, enfriamiento, sesión activa, consentimiento, obra
          // verificada). Si falla la llamada, nunca se auto-inicia: se ofrece la confirmación.
          const accuracyMeters = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : undefined;
          void evaluateRef.current(nearby, { ...here, accuracyMeters })
            .catch((): ArrivalOutcome => ({ action: "ask" }))
            .then((outcome) => {
              if (!active) return;
              if (outcome.action === "none") return; // IGNORE: sin aviso y sin enfriamiento
              cooldownRef.current.set(key, Date.now());
              if (outcome.action === "auto" && outcome.geofenceEventId) {
                onStartRef.current(nearby, { ...here, method: "proximity_auto", geofenceEventId: outcome.geofenceEventId });
              } else {
                setBanner({ site: nearby, ...here });
              }
            });
          return;
        }
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

    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
      setIsWatching(false);
    };
  }, [params.enabled, params.mode, sites, radiusMeters, cooldownMs, serverAuthority]);

  const acceptBanner = useCallback(() => {
    if (!banner) return;
    onStartRef.current(banner.site, { latitude: banner.latitude, longitude: banner.longitude, method: "proximity_confirmed" });
    setBanner(null);
  }, [banner]);

  const dismissBanner = useCallback(() => {
    if (banner) cooldownRef.current.set(siteKey(banner.site), Date.now());
    setBanner(null);
  }, [banner]);

  /**
   * Muestra el aviso de confirmación para un sitio. Lo usa el tracker cuando un inicio
   * automático no se completa (409 `auto_start_not_authorized`, sin conexión, 5xx): solo un
   * toque explícito de la persona envía después `proximity_confirmed`.
   */
  const offerConfirmation = useCallback((site: ProximitySite, here: { latitude: number; longitude: number }) => {
    cooldownRef.current.set(siteKey(site), Date.now());
    setBanner({ site, latitude: here.latitude, longitude: here.longitude });
  }, []);

  return { banner, acceptBanner, dismissBanner, offerConfirmation, locationError, isWatching };
}
