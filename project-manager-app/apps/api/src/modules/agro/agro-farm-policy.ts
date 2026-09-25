/**
 * Política de recurso de una finca Agro (segunda capa, después de RBAC).
 *
 * RBAC (`@RequirePermissions`) decide si el actor puede usar el endpoint en
 * general; esta política decide qué puede hacer en ESTA finca según su rol de
 * finca. El propietario es implícito (`AgroFarm.ownerId`); el resto de roles
 * vienen de `AgroFarmMember` con status ACTIVE.
 *
 * Función pura para poder testearla exhaustivamente sin DB. Matriz documentada
 * en docs/specs/agro/AGRO_AS_IS_AUDIT_2026-09-25.md §6.
 */

export const AGRO_FARM_MEMBER_ROLES = [
  "MANAGER", "SUPERVISOR", "WORKER", "TECHNICIAN", "SPECIALIST", "VETERINARIAN", "AGRONOMIST",
] as const;

export type AgroFarmMemberRole = typeof AGRO_FARM_MEMBER_ROLES[number];
export type AgroFarmRole = "OWNER" | AgroFarmMemberRole;

export const AGRO_FARM_MEMBER_STATUSES = ["INVITED", "ACTIVE", "SUSPENDED", "REVOKED"] as const;

export type AgroFarmAction =
  | "farm.read"
  | "members.manage"
  | "incident.read"
  | "incident.report"
  | "incident.comment"
  | "incident.add_evidence"
  | "incident.triage"
  | "incident.assign"
  | "incident.link_task"
  | "incident.start"
  | "incident.resolve"
  | "incident.assess"
  | "incident.close"
  | "incident.reopen"
  | "incident.cancel"
  | "workforce.read_any"
  | "workforce.self_report"
  | "workforce.assign"
  | "capability.verify"
  | "capability.verify_professional";

const MANAGERS: readonly AgroFarmRole[] = ["OWNER", "MANAGER"];
const SUPERVISORS: readonly AgroFarmRole[] = ["OWNER", "MANAGER", "SUPERVISOR"];
const PROFESSIONALS: readonly AgroFarmRole[] = ["TECHNICIAN", "SPECIALIST", "VETERINARIAN", "AGRONOMIST"];
const EVERYONE: readonly AgroFarmRole[] = ["OWNER", ...AGRO_FARM_MEMBER_ROLES];

const MATRIX: Record<AgroFarmAction, readonly AgroFarmRole[]> = {
  "farm.read": EVERYONE,
  "members.manage": MANAGERS,
  "incident.read": EVERYONE,
  "incident.report": EVERYONE,
  "incident.comment": EVERYONE,
  "incident.add_evidence": EVERYONE,
  "incident.triage": SUPERVISORS,
  "incident.assign": SUPERVISORS,
  "incident.link_task": SUPERVISORS,
  // El responsable asignado también puede iniciar/resolver (ver `isAssignee`).
  "incident.start": [...SUPERVISORS, ...PROFESSIONALS],
  "incident.resolve": [...SUPERVISORS, ...PROFESSIONALS],
  // Evaluación profesional: solo roles profesionales, nunca el dueño por serlo.
  "incident.assess": PROFESSIONALS,
  "incident.close": SUPERVISORS,
  "incident.reopen": SUPERVISORS,
  "incident.cancel": SUPERVISORS,
  "workforce.read_any": [...SUPERVISORS, ...PROFESSIONALS],
  "workforce.self_report": EVERYONE,
  "workforce.assign": SUPERVISORS,
  "capability.verify": [...SUPERVISORS, ...PROFESSIONALS],
  "capability.verify_professional": PROFESSIONALS,
};

export function isAgroFarmMemberRole(value: string): value is AgroFarmMemberRole {
  return (AGRO_FARM_MEMBER_ROLES as readonly string[]).includes(value);
}

export function canPerformAgroFarmAction(
  role: AgroFarmRole | null,
  action: AgroFarmAction,
  opts: { isAssignee?: boolean } = {},
): boolean {
  if (!role) return false;
  if (MATRIX[action].includes(role)) return true;
  if (opts.isAssignee && (action === "incident.start" || action === "incident.resolve")) return true;
  return false;
}

export function isProfessionalFarmRole(role: AgroFarmRole | null): boolean {
  return role !== null && PROFESSIONALS.includes(role);
}
