export type MobileDomainId =
  | "auth"
  | "jobs"
  | "projects"
  | "milestones"
  | "evidence"
  | "tasks"
  | "materials"
  | "incidents"
  | "field_ops"
  | "tracker"
  | "travel"
  | "payments"
  | "disputes"
  | "matching"
  | "reviews"
  | "knowledge"
  | "agents"
  | "ops";

export type MobileDomainDescriptor = {
  id: MobileDomainId;
  label: string;
  purpose: string;
  canonicalOwner: string;
};

export const MOBILE_DOMAIN_REGISTRY: readonly MobileDomainDescriptor[] = [
  { id: "auth", label: "Auth", purpose: "identidad y sesion", canonicalOwner: "packages/auth + apps/api/auth" },
  { id: "jobs", label: "Jobs", purpose: "publicacion y ejecucion de trabajos", canonicalOwner: "apps/api/jobs" },
  { id: "projects", label: "Projects", purpose: "seguimiento ejecutable", canonicalOwner: "apps/api/projects" },
  { id: "milestones", label: "Milestones", purpose: "review loop y aprobacion", canonicalOwner: "apps/api/milestones" },
  { id: "evidence", label: "Evidence", purpose: "captura y consulta de evidencia", canonicalOwner: "apps/api/evidence" },
  { id: "tasks", label: "Tasks", purpose: "ejecucion operativa", canonicalOwner: "apps/api/tasks" },
  { id: "materials", label: "Materials", purpose: "requerimientos y consumo", canonicalOwner: "apps/api/materials" },
  { id: "incidents", label: "Incidents", purpose: "registro de incidentes", canonicalOwner: "apps/api/incidents" },
  { id: "field_ops", label: "Field Ops", purpose: "operacion de campo", canonicalOwner: "apps/api/field-ops" },
  { id: "tracker", label: "Tracker", purpose: "sesion de seguimiento", canonicalOwner: "apps/api/field-ops" },
  { id: "travel", label: "Travel", purpose: "movilidad, hospedaje y liquidacion", canonicalOwner: "apps/api/travel" },
  { id: "payments", label: "Payments", purpose: "escrow y pagos", canonicalOwner: "apps/api/payments" },
  { id: "disputes", label: "Disputes", purpose: "manejo de disputas", canonicalOwner: "apps/api/disputes" },
  { id: "matching", label: "Matching", purpose: "comparacion y seleccion", canonicalOwner: "apps/api/matching" },
  { id: "reviews", label: "Reviews", purpose: "calificacion y reputacion", canonicalOwner: "apps/api/ratings" },
  { id: "knowledge", label: "Knowledge", purpose: "memoria y conocimiento", canonicalOwner: "packages/knowledge + apps/api/knowledge" },
  { id: "agents", label: "Agents", purpose: "asistencia inteligente", canonicalOwner: "packages/agents + apps/api/agents" },
  { id: "ops", label: "Ops", purpose: "trazabilidad y control", canonicalOwner: "apps/api/ops" },
] as const;
