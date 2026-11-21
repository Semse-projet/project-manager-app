import { appRoleFromRoles, normalizeRoles, type AppRole } from "@semse/auth/rbac";
import type { WorkspaceMissionType } from "@semse/schemas";

export type WorkspaceRole = AppRole;
export type WorkspaceSectionId = "home" | "projects" | "evidence" | "budget" | "planning" | "settings";
export type WorkspaceSection = {
  id: WorkspaceSectionId;
  label: string;
  description: string;
};

export const WORKSPACE_SECTIONS: readonly WorkspaceSection[] = [
  { id: "home", label: "Inicio", description: "Retoma tu contexto y abre las herramientas que necesitas." },
  { id: "projects", label: "Proyectos", description: "Consulta proyectos autorizados y sus hitos, sin mezclar sus referencias." },
  { id: "evidence", label: "Evidencia", description: "Revisa archivos del trabajo y accede a la carga real de evidencia." },
  { id: "budget", label: "Presupuestos", description: "Accede a estimadores y compara propuestas del mismo trabajo." },
  { id: "planning", label: "Planificación", description: "Organiza tu consulta de tareas por vencimiento, estado y prioridad." },
  { id: "settings", label: "Configuración", description: "Adapta la presentación de tu espacio de trabajo a este navegador." },
];

export const WORKSPACE_MISSION_TYPES: readonly { id: WorkspaceMissionType; label: string }[] = [
  { id: "project", label: "Proyecto" },
  { id: "conversation", label: "Conversación" },
  { id: "budget", label: "Presupuesto" },
  { id: "evidence", label: "Evidencia" },
  { id: "planning", label: "Planificación" },
];

export function getWorkspaceSection(id: string): WorkspaceSection {
  return WORKSPACE_SECTIONS.find((section) => section.id === id) ?? WORKSPACE_SECTIONS[0];
}

export function getMissionTypeLabel(type: string): string {
  return WORKSPACE_MISSION_TYPES.find((mission) => mission.id === type)?.label ?? "Referencia";
}

/** Presentation only. The existing backend still authorizes every resource request. */
export function getWorkspaceRole(roles: readonly string[]): WorkspaceRole | null {
  const normalized = normalizeRoles(roles);
  if (!normalized.some((role) => ["OPS_ADMIN", "CLIENT", "PRO", "WORKER"].includes(role))) return null;
  return appRoleFromRoles(roles);
}

export function validateMissionTitle(title: string): string | null {
  const trimmed = title.trim();
  if (!trimmed) return "Escribe un título para la referencia.";
  if (trimmed.length > 200) return "El título admite hasta 200 caracteres.";
  return null;
}

export type WorkspacePreferences = {
  density: "comfortable" | "compact";
  leftPanel: boolean;
  rightPanel: boolean;
};

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  density: "comfortable",
  leftPanel: true,
  rightPanel: true,
};
export const WORKSPACE_PREFERENCES_KEY = "semse.workspace.visual.v1";

export function sanitizePreferences(value: unknown): WorkspacePreferences {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    density: data.density === "compact" ? "compact" : "comfortable",
    leftPanel: typeof data.leftPanel === "boolean" ? data.leftPanel : true,
    rightPanel: typeof data.rightPanel === "boolean" ? data.rightPanel : true,
  };
}
