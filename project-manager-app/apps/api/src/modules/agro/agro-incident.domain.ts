/**
 * Dominio puro de Agro IncidentOps: tipos, severidades y FSM.
 * Spec: docs/specs/agro/agro-incident-ops.spec.md
 */
import type { AgroFarmAction } from "./agro-farm-policy.js";

export const AGRO_INCIDENT_TYPES = [
  "ANIMAL_INJURY", "ANIMAL_ILLNESS_OBSERVED", "ANIMAL_MORTALITY", "ANIMAL_ESCAPE",
  "WATER_SHORTAGE", "FEED_SHORTAGE", "BIOSECURITY_RISK", "INFRASTRUCTURE_DAMAGE",
  "EQUIPMENT_FAILURE", "CROP_DAMAGE", "PEST_OBSERVED", "IRRIGATION_FAILURE",
  "SAFETY_HAZARD", "OTHER",
] as const;
export type AgroIncidentType = typeof AGRO_INCIDENT_TYPES[number];

export const AGRO_INCIDENT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type AgroIncidentSeverity = typeof AGRO_INCIDENT_SEVERITIES[number];

export const AGRO_INCIDENT_STATUSES = [
  "OPEN", "TRIAGED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED", "DUPLICATE",
] as const;
export type AgroIncidentStatus = typeof AGRO_INCIDENT_STATUSES[number];

export const AGRO_INCIDENT_SOURCES = ["WEB", "MOBILE", "SYNC", "PROMETEO", "API"] as const;

/** Categoría operativa por tipo (para filtros, UI y Prometeo). */
export const AGRO_INCIDENT_CATEGORY: Record<AgroIncidentType, "ANIMAL_HEALTH_WELFARE" | "RESOURCES" | "BIOSECURITY" | "INFRASTRUCTURE_EQUIPMENT" | "CROPS" | "SAFETY" | "OTHER"> = {
  ANIMAL_INJURY: "ANIMAL_HEALTH_WELFARE",
  ANIMAL_ILLNESS_OBSERVED: "ANIMAL_HEALTH_WELFARE",
  ANIMAL_MORTALITY: "ANIMAL_HEALTH_WELFARE",
  ANIMAL_ESCAPE: "ANIMAL_HEALTH_WELFARE",
  WATER_SHORTAGE: "RESOURCES",
  FEED_SHORTAGE: "RESOURCES",
  BIOSECURITY_RISK: "BIOSECURITY",
  INFRASTRUCTURE_DAMAGE: "INFRASTRUCTURE_EQUIPMENT",
  EQUIPMENT_FAILURE: "INFRASTRUCTURE_EQUIPMENT",
  IRRIGATION_FAILURE: "INFRASTRUCTURE_EQUIPMENT",
  CROP_DAMAGE: "CROPS",
  PEST_OBSERVED: "CROPS",
  SAFETY_HAZARD: "SAFETY",
  OTHER: "OTHER",
};

/**
 * Severidad por defecto sugerida para un reporte sin clasificar. Es una
 * sugerencia operativa (prioridad de atención), no un juicio clínico:
 * `severityConfirmed` queda en false hasta que alguien con autoridad la confirme.
 */
export function suggestedSeverity(type: AgroIncidentType): AgroIncidentSeverity {
  switch (type) {
    case "ANIMAL_MORTALITY":
    case "BIOSECURITY_RISK":
    case "WATER_SHORTAGE":
    case "SAFETY_HAZARD":
      return "HIGH";
    case "OTHER":
      return "LOW";
    default:
      return "MEDIUM";
  }
}

const TRANSITIONS: Record<AgroIncidentStatus, readonly AgroIncidentStatus[]> = {
  OPEN: ["TRIAGED", "IN_PROGRESS", "CANCELLED", "DUPLICATE"],
  TRIAGED: ["IN_PROGRESS", "RESOLVED", "CANCELLED", "DUPLICATE"],
  IN_PROGRESS: ["RESOLVED", "CANCELLED"],
  // IN_PROGRESS desde RESOLVED/CLOSED = reapertura.
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: ["IN_PROGRESS"],
  CANCELLED: [],
  DUPLICATE: [],
};

export function isAgroIncidentStatus(value: string): value is AgroIncidentStatus {
  return (AGRO_INCIDENT_STATUSES as readonly string[]).includes(value);
}

export function canTransitionIncident(from: string, to: string): boolean {
  if (!isAgroIncidentStatus(from) || !isAgroIncidentStatus(to)) return false;
  return TRANSITIONS[from].includes(to);
}

export function allowedIncidentTransitions(from: string): readonly AgroIncidentStatus[] {
  return isAgroIncidentStatus(from) ? TRANSITIONS[from] : [];
}

export function isReopen(from: string, to: string): boolean {
  return to === "IN_PROGRESS" && (from === "RESOLVED" || from === "CLOSED");
}

/** Acción de política requerida para una transición. */
export function incidentTransitionAction(from: string, to: AgroIncidentStatus): AgroFarmAction {
  if (isReopen(from, to)) return "incident.reopen";
  switch (to) {
    case "TRIAGED": return "incident.triage";
    case "IN_PROGRESS": return "incident.start";
    case "RESOLVED": return "incident.resolve";
    case "CLOSED": return "incident.close";
    case "CANCELLED":
    case "DUPLICATE": return "incident.cancel";
    default: return "incident.triage";
  }
}

/** Nombre de la acción de auditoría (timeline) para una transición. */
export function incidentTransitionAuditAction(from: string, to: AgroIncidentStatus): string {
  if (isReopen(from, to)) return "incident.reopened";
  switch (to) {
    case "TRIAGED": return "incident.triaged";
    case "IN_PROGRESS": return "incident.started";
    case "RESOLVED": return "incident.resolved";
    case "CLOSED": return "incident.closed";
    case "CANCELLED": return "incident.cancelled";
    case "DUPLICATE": return "incident.marked_duplicate";
    default: return "incident.status_changed";
  }
}

/** Estados en los que la incidencia sigue editable (clasificar, asignar, comentar…). */
export function isIncidentActive(status: string): boolean {
  return status === "OPEN" || status === "TRIAGED" || status === "IN_PROGRESS";
}

/** Timestamps que acompañan cada transición. */
export function incidentTransitionTimestamps(from: string, to: AgroIncidentStatus, now: Date) {
  const patch: { triagedAt?: Date; resolvedAt?: Date | null; closedAt?: Date | null } = {};
  if (to === "TRIAGED") patch.triagedAt = now;
  if (to === "RESOLVED") patch.resolvedAt = now;
  if (to === "CLOSED") patch.closedAt = now;
  if (isReopen(from, to)) { patch.resolvedAt = null; patch.closedAt = null; }
  return patch;
}
