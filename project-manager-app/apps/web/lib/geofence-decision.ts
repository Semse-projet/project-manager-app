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

/** Sitios que la detección local puede usar. `null` conserva el modo anterior. */
export function proximitySitesFromGeofenceLoad<TServer, TLegacy>(
  load: GeofenceSitesLoad<TServer>,
  legacy: TLegacy[],
): TServer[] | TLegacy[] {
  if (load.status === "disabled") return legacy;
  if (load.status === "ready") return load.sites;
  return [];
}
