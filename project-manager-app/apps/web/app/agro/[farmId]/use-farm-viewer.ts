"use client";

import { useEffect, useState } from "react";
import { farmTabs } from "./farm-tabs";

/** Rol del usuario en la finca y acciones que la política de finca le permite (API `GET /agro/:farmId`). */
export type FarmViewer = { role: string; actions: string[] };

// Caché por finca durante la sesión de navegación: evita re-pedirlo en cada pestaña.
const cache = new Map<string, FarmViewer | null>();
const pending = new Map<string, Promise<FarmViewer | null>>();

function loadViewer(farmId: string): Promise<FarmViewer | null> {
  const inflight = pending.get(farmId);
  if (inflight) return inflight;
  const request = fetch(`/api/semse/agro/${encodeURIComponent(farmId)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      const farm = json?.data?.farm;
      const viewer: FarmViewer | null = farm?.viewerRole
        ? { role: String(farm.viewerRole), actions: Array.isArray(farm.viewerActions) ? farm.viewerActions : [] }
        : null;
      cache.set(farmId, viewer);
      return viewer;
    })
    .catch(() => null)
    .finally(() => pending.delete(farmId));
  pending.set(farmId, request);
  return request;
}

/** null mientras no se conoce (o si el API no lo devuelve): la UI se comporta como antes y el API decide. */
export function useFarmViewer(farmId: string | undefined): FarmViewer | null {
  const [viewer, setViewer] = useState<FarmViewer | null>(() => (farmId ? cache.get(farmId) ?? null : null));
  useEffect(() => {
    if (!farmId) return;
    if (cache.has(farmId)) { setViewer(cache.get(farmId) ?? null); return; }
    let alive = true;
    void loadViewer(farmId).then((v) => { if (alive) setViewer(v); });
    return () => { alive = false; };
  }, [farmId]);
  return viewer;
}

/** Pestañas de la finca que el rol puede abrir. */
export function useFarmTabs(farmId: string | undefined) {
  const viewer = useFarmViewer(farmId);
  return farmId ? farmTabs(farmId, viewer) : [];
}
