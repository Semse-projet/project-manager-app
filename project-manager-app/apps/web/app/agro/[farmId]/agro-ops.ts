/**
 * Cliente y vocabulario compartido de Agro Workforce + IncidentOps (web).
 * Todas las llamadas pasan por el BFF /api/semse/agro/** (nunca directo al API).
 */

export class AgroOpsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function errorMessage(json: any, status: number): string {
  const m = json?.error?.message;
  if (typeof m === "string") return m;
  if (m && typeof m === "object") {
    if (typeof m.message === "string") return m.message;
    if (m.fieldErrors) return Object.entries(m.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join(" · ");
  }
  return `HTTP ${status}`;
}

export async function agroFetch<T>(path: string, init?: { method?: "GET" | "POST" | "PATCH"; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/semse/agro${path}`, {
    method: init?.method ?? "GET",
    ...(init?.body !== undefined && { headers: { "content-type": "application/json" }, body: JSON.stringify(init.body) }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new AgroOpsError(errorMessage(json, res.status), res.status);
  return json?.data as T;
}

/** 403/404 desde el API significan "sin acceso a esta finca" (no se filtra existencia). */
export function isForbidden(err: unknown): boolean {
  return err instanceof AgroOpsError && (err.status === 403 || err.status === 404);
}

export const INCIDENT_TYPE_LABEL: Record<string, string> = {
  ANIMAL_INJURY: "Animal herido",
  ANIMAL_ILLNESS_OBSERVED: "Signos de enfermedad",
  ANIMAL_MORTALITY: "Mortalidad",
  ANIMAL_ESCAPE: "Animal escapado",
  WATER_SHORTAGE: "Falta de agua",
  FEED_SHORTAGE: "Falta de alimento",
  BIOSECURITY_RISK: "Riesgo de bioseguridad",
  INFRASTRUCTURE_DAMAGE: "Daño de infraestructura",
  EQUIPMENT_FAILURE: "Falla de equipo",
  CROP_DAMAGE: "Daño de cultivo",
  PEST_OBSERVED: "Plaga observada",
  IRRIGATION_FAILURE: "Falla de riego",
  SAFETY_HAZARD: "Riesgo de seguridad",
  OTHER: "Otro",
};
export const INCIDENT_TYPES = Object.keys(INCIDENT_TYPE_LABEL);

export const SEVERITY_LABEL: Record<string, string> = { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", CRITICAL: "Crítica" };
export const SEVERITY_BADGE: Record<string, string> = {
  LOW: "badge badge-slate", MEDIUM: "badge badge-blue", HIGH: "badge badge-amber", CRITICAL: "badge badge-red",
};
export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export const STATUS_LABEL: Record<string, string> = {
  OPEN: "Abierta", TRIAGED: "Clasificada", IN_PROGRESS: "En curso", RESOLVED: "Resuelta",
  CLOSED: "Cerrada", CANCELLED: "Cancelada", DUPLICATE: "Duplicada",
};
export const STATUS_BADGE: Record<string, string> = {
  OPEN: "badge badge-amber", TRIAGED: "badge badge-violet", IN_PROGRESS: "badge badge-blue",
  RESOLVED: "badge badge-green", CLOSED: "badge badge-slate", CANCELLED: "badge badge-slate", DUPLICATE: "badge badge-slate",
};

export const TRANSITION_LABEL: Record<string, string> = {
  TRIAGED: "Marcar clasificada", IN_PROGRESS: "Iniciar", RESOLVED: "Resolver", CLOSED: "Cerrar",
  CANCELLED: "Cancelar", DUPLICATE: "Marcar duplicada",
};

export const FARM_ROLE_LABEL: Record<string, string> = {
  OWNER: "Propietario", MANAGER: "Administrador", SUPERVISOR: "Supervisor / capataz", WORKER: "Trabajador",
  TECHNICIAN: "Técnico", SPECIALIST: "Especialista", VETERINARIAN: "Veterinario/a", AGRONOMIST: "Agrónomo/a",
};
export const FARM_MEMBER_ROLES = ["MANAGER", "SUPERVISOR", "WORKER", "TECHNICIAN", "SPECIALIST", "VETERINARIAN", "AGRONOMIST"];

export const CAP_STATUS_LABEL: Record<string, string> = {
  SELF_REPORTED: "Autodeclarada", IN_REVIEW: "En revisión", VERIFIED: "Verificada",
  REJECTED: "Rechazada", EXPIRED: "Vencida", REVOKED: "Revocada",
};
export const CAP_STATUS_BADGE: Record<string, string> = {
  SELF_REPORTED: "badge badge-slate", IN_REVIEW: "badge badge-violet", VERIFIED: "badge badge-green",
  REJECTED: "badge badge-red", EXPIRED: "badge badge-amber", REVOKED: "badge badge-red",
};
export const CAP_LEVEL_LABEL: Record<string, string> = { BASIC: "Básico", INTERMEDIATE: "Intermedio", ADVANCED: "Avanzado", EXPERT: "Experto" };
export const CAP_LEVELS = ["BASIC", "INTERMEDIATE", "ADVANCED", "EXPERT"];
export const VERIFICATION_METHOD_LABEL: Record<string, string> = {
  DIRECT_OBSERVATION: "Observación directa", PRACTICAL_TEST: "Prueba práctica", DOCUMENT_REVIEW: "Revisión documental",
  CERTIFICATE: "Certificado", INTERVIEW: "Entrevista", OTHER: "Otro",
};

export const MEDIA_TYPES = ["NOTE", "PHOTO", "VIDEO", "AUDIO", "DOCUMENT", "FORM", "MEASUREMENT", "EXTERNAL_URL"];
export const MEDIA_LABEL: Record<string, string> = {
  NOTE: "Nota", PHOTO: "Foto", VIDEO: "Video", AUDIO: "Audio", DOCUMENT: "Documento",
  FORM: "Formulario", MEASUREMENT: "Medición", EXTERNAL_URL: "Enlace", OTHER: "Otro",
};

export const TIMELINE_LABEL: Record<string, string> = {
  "incident.created": "Incidencia creada",
  "incident.triaged": "Clasificada",
  "incident.severity_changed": "Severidad modificada",
  "incident.type_changed": "Tipo modificado",
  "incident.relations_changed": "Relaciones actualizadas",
  "incident.updated": "Descripción editada",
  "incident.assigned": "Asignada",
  "incident.unassigned": "Sin responsable",
  "incident.evidence_added": "Evidencia agregada",
  "incident.task_linked": "Tarea relacionada",
  "incident.task_unlinked": "Tarea desvinculada",
  "incident.comment_added": "Comentario",
  "incident.assessment_added": "Evaluación profesional",
  "incident.started": "En curso",
  "incident.resolved": "Resuelta",
  "incident.closed": "Cerrada",
  "incident.reopened": "Reabierta",
  "incident.cancelled": "Cancelada",
  "incident.marked_duplicate": "Marcada duplicada",
  "capability.declared": "Capacidad declarada",
  "capability.redeclared": "Capacidad declarada de nuevo",
  "capability.review_requested": "Revisión solicitada",
  "capability.verified": "Verificada",
  "capability.rejected": "Rechazada",
  "capability.revoked": "Verificación revocada",
};

export function fmtDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export function shortId(id?: string | null): string {
  if (!id) return "—";
  return id.length > 10 ? `…${id.slice(-6)}` : id;
}

export function newClientEventId(): string {
  const c = (globalThis as any).crypto;
  return c?.randomUUID ? c.randomUUID() : `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
