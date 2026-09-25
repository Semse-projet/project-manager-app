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

// Mirrors apps/web/app/(app)/client/jobs/page.tsx's FILTERS bucketing.
export const CLIENT_JOB_TAB_BUCKETS = {
  draft: ["draft"] as JobRecordStatus[],
  active: ["in_progress", "reserved", "accepted", "review"] as JobRecordStatus[],
  pending: ["posted", "published"] as JobRecordStatus[],
  review: ["review"] as JobRecordStatus[],
  completed: ["completed"] as JobRecordStatus[],
};

// Mirrors apps/web's headerCopy for the same tabs — shown as a banner under
// the active tab, not per-card (the Client list groups by intent, it doesn't
// tell the client to "do" something the way the Worker list does).
export const CLIENT_JOB_TAB_HEADER_COPY: Partial<
  Record<keyof typeof CLIENT_JOB_TAB_BUCKETS, { title: string; detail: string }>
> = {
  draft: { title: "Borradores", detail: "Trabajos que todavía no publicaste." },
  active: { title: "Trabajos activos", detail: "Trabajos reservados, aceptados, en progreso o en revisión." },
  pending: { title: "Esperando propuestas", detail: "Trabajos publicados que todavía no tienen una propuesta aceptada." },
  review: { title: "En revisión", detail: "El profesional envió una entrega para tu revisión." },
  completed: { title: "Completados", detail: "Trabajos cerrados." },
};

// Adapted from apps/web/app/(app)/client/jobs/[jobId]/page.tsx's
// JOB_NEXT_ACTION (client-perspective copy) — trimmed to statuses where
// mobile actually has a real path forward, and reworded wherever web's copy
// names an action mobile doesn't have (publishing a draft, funding escrow,
// requesting milestone changes, opening the disputes panel — all explicitly
// out of scope per docs/specs/ui/mobile-client-tab.spec.md). No entry means
// no banner: "accepted" is intentionally omitted rather than guessed, since
// whether escrow is funded isn't available on JobRecordView.
export const CLIENT_JOB_NEXT_ACTION: Partial<Record<JobRecordStatus, string>> = {
  draft: "Este trabajo está en borrador — publícalo desde la versión web para recibir propuestas.",
  posted: "El trabajo está publicado. Revisa propuestas cuando lleguen.",
  published: "El trabajo está publicado. Revisa propuestas cuando lleguen.",
  in_progress: "El profesional está trabajando. Revisa milestones y evidencia.",
  review: "El profesional envió este milestone para revisión — apruébalo si corresponde.",
  dispute: "Hay una disputa activa en este trabajo. El equipo de soporte la está revisando.",
  completed: "El trabajo se cerró correctamente. Puedes dejar una calificación.",
  cancelled: "Este trabajo fue cancelado.",
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
