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
