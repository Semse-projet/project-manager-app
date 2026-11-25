/**
 * OPEN-18 (docs/specs/core/worksite-location-binding.spec.md, W-07): qué hace el cliente con
 * la decisión del servidor ante una llegada a una obra vinculada. El servidor es la
 * autoridad: el cliente solo auto-inicia con AUTO_START_ALLOWED y pasa su `id` como
 * `geofenceEventId`; PROMPT/MANUAL_ONLY piden confirmación a la persona; el resto no hace nada.
 * Se decide por `decision`, nunca por el texto de `reason`.
 */
export type ServerGeofenceDecision = "PROMPT" | "AUTO_START_ALLOWED" | "MANUAL_ONLY" | "LEAVE_PROMPT" | "EXCEPTION" | "IGNORE";
export type ProximityAction = "auto" | "ask" | "none";

export function proximityActionForDecision(decision: ServerGeofenceDecision | string | null | undefined): ProximityAction {
  if (decision === "AUTO_START_ALLOWED") return "auto";
  if (decision === "PROMPT" || decision === "MANUAL_ONLY") return "ask";
  return "none";
}

/** Tipo de sitio del cliente ("job"/"free") ↔ contrato del servidor ("JOB"/"FREE_PROJECT"). */
export function serverSiteKind(kind: "job" | "free"): "JOB" | "FREE_PROJECT" {
  return kind === "job" ? "JOB" : "FREE_PROJECT";
}

export function clientSiteKind(kind: "JOB" | "FREE_PROJECT"): "job" | "free" {
  return kind === "JOB" ? "job" : "free";
}

/**
 * Resultado de `GET /v1/me/geofence-sites`.
 * - `disabled`: 404, el flag está apagado y sigue el modo anterior.
 * - `ready`: la lista del servidor manda, aunque esté vacía.
 * - `unavailable`: red, 5xx, 401 u otro fallo. Falla cerrado: no se usan las
 *   coordenadas locales, para no auto-iniciar sin una decisión del servidor.
 */
export type GeofenceSitesLoad<T> =
  | { status: "disabled" }
  | { status: "ready"; sites: T[] }
  | { status: "unavailable" };

export function classifyGeofenceSitesLoad<T>(
  result: { ok: true; sites: T[] | null } | { ok: false },
): GeofenceSitesLoad<T> {
  if (!result.ok) return { status: "unavailable" };
  if (result.sites === null) return { status: "disabled" };
  return { status: "ready", sites: result.sites };
}

/**
 * Lo que el tracker web guarda como `geofenceSites`, a partir del resultado de
 * `GET /v1/me/geofence-sites`:
 * - `null` → 404: el flag está apagado y la detección usa los jobs y proyectos locales;
 * - lista del servidor (aunque esté vacía) → el servidor manda;
 * - `[]` → red, 5xx, 401: falla cerrado, sin coordenadas locales ni auto-inicio.
 */
export function trackerGeofenceSites<TServer, TSite>(
  result: { ok: true; sites: TServer[] | null } | { ok: false },
  toSite: (site: TServer) => TSite,
): TSite[] | null {
  const load = classifyGeofenceSitesLoad(result);
  if (load.status === "disabled") return null;
  if (load.status === "unavailable") return [];
  return load.sites.map(toSite);
}

/**
 * Un inicio automático solo vale con la decisión del servidor en ese momento: si no se
 * completa, no se guarda para reintentarlo sin conexión (saldría como inicio manual, sin la
 * autorización) y se pide confirmación. Los demás inicios sí se pueden reintentar.
 */
export function canRetryStartOffline(method: "proximity_confirmed" | "proximity_auto" | undefined): boolean {
  return method !== "proximity_auto";
}
