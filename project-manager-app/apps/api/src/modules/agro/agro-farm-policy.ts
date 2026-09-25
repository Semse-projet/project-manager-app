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
  | "capability.verify_professional"
  // Operación diaria de la finca (T-050): servicios Agro existentes.
  | "farm.manage"
  | "farm.audit_read"
  | "farm.finance"
  | "task.create"
  | "task.update"
  | "task.execute"
  | "animal.operate"
  | "animal.status"
  | "evidence.create"
  | "evidence.update_any"
  | "inventory.consume"
  | "inventory.manage";

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
  // Estructura de la finca (datos de la finca, unidades, alta de animales/grupos, catálogo de inventario).
  "farm.manage": MANAGERS,
  "farm.audit_read": SUPERVISORS,
  // Datos económicos (costos, ventas, rentabilidad, valores, reporte semanal):
  // propietario y MANAGER (decisión de producto 2026-09-25). El resto de
  // miembros no ve cifras económicas.
  "farm.finance": MANAGERS,
  "task.create": SUPERVISORS,
  "task.update": SUPERVISORS,
  // El trabajador ejecuta (iniciar/completar/bloquear) sus tareas o las no asignadas (ver `isAssignee`).
  "task.execute": [...SUPERVISORS, ...PROFESSIONALS],
  // Mover y pesar animales es trabajo de campo.
  "animal.operate": EVERYONE,
  // Estado (muerto, perdido, vendido…) y ajustes de conteo: supervisión y veterinaria.
  "animal.status": [...SUPERVISORS, "VETERINARIAN"],
  "evidence.create": EVERYONE,
  "evidence.update_any": SUPERVISORS,
  // Registrar consumo (salidas) de inventario es trabajo de campo; entradas y ajustes, supervisión.
  "inventory.consume": EVERYONE,
  "inventory.manage": SUPERVISORS,
};

const ASSIGNEE_ACTIONS: readonly AgroFarmAction[] = ["incident.start", "incident.resolve", "task.execute"];

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
  if (opts.isAssignee && ASSIGNEE_ACTIONS.includes(action)) return true;
  return false;
}

/** Acciones que el rol puede hacer sin ser responsable asignado (para que la UI oculte lo que no aplica). */
export function allowedAgroFarmActions(role: AgroFarmRole | null): AgroFarmAction[] {
  if (!role) return [];
  return (Object.keys(MATRIX) as AgroFarmAction[]).filter((action) => MATRIX[action].includes(role));
}

export function isProfessionalFarmRole(role: AgroFarmRole | null): boolean {
  return role !== null && PROFESSIONALS.includes(role);
}
