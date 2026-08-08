import type { JobRecordStatus } from "@semse/schemas";

export const JOB_STATUS_LABEL: Record<JobRecordStatus, string> = {
  draft: "Borrador",
  posted: "Publicado",
  published: "Publicado",
  reserved: "Reservado",
  accepted: "Aceptado",
  in_progress: "En progreso",
  review: "En revisión",
  dispute: "En disputa",
  completed: "Completado",
  awarded: "Adjudicado",
  cancelled: "Cancelado",
};

export const BIDDABLE_JOB_STATUSES: JobRecordStatus[] = ["posted", "published"];

export const JOB_STATUS_COLOR_KEY: Record<JobRecordStatus, "ok" | "error" | "warn" | "brand" | "muted"> = {
  draft: "muted",
  posted: "brand",
  published: "brand",
  reserved: "warn",
  accepted: "ok",
  in_progress: "brand",
  review: "warn",
  dispute: "error",
  completed: "muted",
  awarded: "ok",
  cancelled: "muted",
};

// Mirrors apps/web/app/(app)/worker/jobs/page.tsx's WORKER_NEXT_ACTION (list-page
// version — web's detail page has its own, slightly different copy). Statuses with
// no entry here have no actionable next step to surface.
export const WORKER_JOB_NEXT_ACTION: Partial<Record<JobRecordStatus, string>> = {
  reserved: "Acepta el trabajo para confirmar tu lugar.",
  accepted: "Abre el trabajo para ver si el escrow está listo.",
  in_progress: "Avanza el milestone y sube evidencia cuando termines.",
  review: "El cliente está revisando tu entrega. Espera aprobación.",
  dispute: "Hay una disputa activa. Aporta evidencia si la tienes.",
  completed: "Trabajo cerrado. Puedes pedir calificación al cliente.",
};

// Same bucketing apps/web's worker jobs list page uses for its "Activos" /
// "Completados" tabs. "Oportunidades" reuses BIDDABLE_JOB_STATUSES above.
export const JOB_TAB_BUCKETS = {
  active: ["in_progress", "accepted", "review", "reserved"] as JobRecordStatus[],
  completed: ["completed"] as JobRecordStatus[],
};

export const BID_STATUS_LABEL: Record<string, string> = {
  submitted: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
};

export const BID_STATUS_COLOR_KEY: Record<string, "ok" | "error" | "brand"> = {
  accepted: "ok",
  rejected: "error",
  submitted: "brand",
};

export const DISPUTE_STATUS_LABEL: Record<string, string> = {
  OPEN: "Abierta",
  ASSIGNED: "Asignada",
  UNDER_REVIEW: "En revisión",
  RESOLVED: "Resuelta",
  REJECTED: "Rechazada",
};

export const DISPUTE_STATUS_COLOR_KEY: Record<string, "ok" | "error" | "warn" | "brand" | "muted"> = {
  OPEN: "warn",
  ASSIGNED: "brand",
  UNDER_REVIEW: "brand",
  RESOLVED: "ok",
  REJECTED: "error",
};

export const TRAVEL_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  PLANNED: "Planeado",
  ACTIVE: "En curso",
  PENDING_SETTLEMENT: "Por liquidar",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
};
