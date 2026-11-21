import type {
  BuildOpsProject,
  BuildOpsTask,
  BuildOpsTaskPriority,
  BuildOpsTaskStatus,
} from "../../lib/buildops-api";

export type PlanningTask = Pick<BuildOpsTask,
  "id" | "projectId" | "title" | "projectTitle" | "status" | "priority" | "dueDate"
>;
export type PlanningFilters = {
  /** BuildOpsProject.id exclusivamente; nunca canonicalProjectId ni Job.id. */
  projectId?: string;
  status?: BuildOpsTaskStatus | "";
  priority?: BuildOpsTaskPriority | "";
};

export const PLANNING_STATUS_LABELS: Record<BuildOpsTaskStatus, string> = {
  todo: "Por hacer",
  in_progress: "En curso",
  blocked: "Bloqueada",
  done: "Terminada",
  canceled: "Cancelada",
};
export const PLANNING_PRIORITY_LABELS: Record<BuildOpsTaskPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export type PlanningDueDate =
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "valid"; date: Date };

/**
 * Solo fechas ISO reales. YYYY-MM-DD representa un día civil LOCAL, no UTC.
 * Timestamps requieren zona explícita y se presentan en la zona del navegador.
 * Rechazamos días imposibles (Date.parse normaliza algunos, p. ej. 30 de febrero).
 */
export function parsePlanningDueDate(value: string | null): PlanningDueDate {
  if (value === null || value === undefined) return { kind: "missing" };
  if (typeof value !== "string") return { kind: "invalid" };
  const parts = /^(\d{4})-(\d{2})-(\d{2})(.*)$/.exec(value);
  if (!parts) return { kind: "invalid" };
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
    return { kind: "invalid" };
  }
  if (!parts[4]) {
    const local = new Date(0);
    local.setFullYear(year, month - 1, day);
    local.setHours(0, 0, 0, 0);
    return { kind: "valid", date: local };
  }
  const time = /^T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(parts[4]);
  if (!time) return { kind: "invalid" };
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) ? { kind: "valid", date: timestamp } : { kind: "invalid" };
}

export function filterPlanningTasks<T extends PlanningTask>(tasks: readonly T[], filters: PlanningFilters): T[] {
  return tasks.filter((task) => {
    const projectMatches = !filters.projectId || (filters.projectId === "unassigned"
      ? task.projectId === null
      : task.projectId === filters.projectId);
    return projectMatches && (!filters.status || task.status === filters.status)
      && (!filters.priority || task.priority === filters.priority);
  });
}

/**
 * «Hoy» empieza a medianoche en la zona local del navegador (incluidos cambios DST).
 * Próximas incluye hoy y todas las fechas futuras; sin horizonte inventado.
 * Agrupar por fecha no modifica ni deduce estados: done/canceled siguen visibles.
 * Fechas inválidas quedan sin fecha utilizable y la UI las identifica explícitamente.
 */
export function groupPlanningTasks<T extends PlanningTask>(tasks: readonly T[], now: Date = new Date()) {
  const groups: { overdue: T[]; upcoming: T[]; undated: T[] } = { overdue: [], upcoming: [], undated: [] };
  const today = new Date(now.getTime());
  today.setHours(0, 0, 0, 0);
  for (const task of tasks) {
    const due = parsePlanningDueDate(task.dueDate);
    if (due.kind !== "valid") groups.undated.push(task);
    else if (due.date.getTime() < today.getTime()) groups.overdue.push(task);
    else groups.upcoming.push(task);
  }
  const byDate = (a: T, b: T) => {
    const first = parsePlanningDueDate(a.dueDate);
    const second = parsePlanningDueDate(b.dueDate);
    return first.kind === "valid" && second.kind === "valid" ? first.date.getTime() - second.date.getTime() : 0;
  };
  groups.overdue.sort(byDate);
  groups.upcoming.sort(byDate);
  return groups;
}

export function planningTaskHref(task: Pick<BuildOpsTask, "id">): string {
  return `/buildops/tasks/${encodeURIComponent(task.id)}`;
}

export function planningProjectHref(project: Pick<BuildOpsProject, "id" | "canonicalProjectId">): string {
  return `/buildops/projects/${encodeURIComponent(project.id)}`;
}
