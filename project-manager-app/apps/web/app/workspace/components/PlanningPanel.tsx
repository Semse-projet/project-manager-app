"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AlertCircle, ArrowUpRight, CalendarDays, CheckSquare, Flag, RefreshCw } from "lucide-react";
import { fetchBuildOpsProjects, fetchBuildOpsTasks, type BuildOpsProject, type BuildOpsTask } from "../../lib/buildops-api";
import type { WorkspaceRole } from "../lib/workspace-model";
import { isWorkspaceAccessError, useWorkspaceQuery } from "../lib/use-workspace-query";
import {
  filterPlanningTasks, groupPlanningTasks, parsePlanningDueDate,
  planningProjectHref, planningTaskHref, PLANNING_PRIORITY_LABELS, PLANNING_STATUS_LABELS,
  type PlanningFilters,
} from "../lib/planning-model";
import { PanelState } from "./PanelState";

const controlClass = "min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)] disabled:opacity-60";
const linkClass = "inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]";

/** Solo presentación. BFF/API conservan permisos efectivos por tenant/org/recurso. */
export function PlanningPanel({ role }: { role: WorkspaceRole | null }) {
  if (!role) {
    return <PanelState title="Planificación no disponible" description="No se pudo resolver un rol autorizado. No se consultaron tareas ni proyectos." />;
  }
  // Cambiar/perder rol desmonta las consultas y limpia selección/datos anteriores.
  return <AuthorizedPlanningPanel key={role} role={role} />;
}

function AuthorizedPlanningPanel({ role }: { role: WorkspaceRole }) {
  const [filters, setFilters] = useState<PlanningFilters>({});
  const loadTasks = useCallback(async () => {
    const result = await fetchBuildOpsTasks();
    if (!Array.isArray(result)) throw new Error("El listado de tareas no tiene el formato esperado.");
    return result;
  }, []);
  const loadProjects = useCallback(async () => {
    const result = await fetchBuildOpsProjects();
    if (!Array.isArray(result)) throw new Error("El listado de proyectos no tiene el formato esperado.");
    return result;
  }, []);
  const tasksQuery = useWorkspaceQuery<BuildOpsTask[]>(`planning:tasks:${role}`, loadTasks);
  const projectsQuery = useWorkspaceQuery<BuildOpsProject[]>(`planning:projects:${role}`, loadProjects);
  const projects = projectsQuery.data ?? [];
  // Filtros locales: no consulta dependiente de selección ni snapshot del proyecto previo.
  const selectedProject = projects.find((project) => project.id === filters.projectId);
  const filteredTasks = filterPlanningTasks(tasksQuery.data ?? [], filters);
  const groups = groupPlanningTasks(filteredTasks);
  const projectUnavailable = Boolean(filters.projectId && filters.projectId !== "unassigned" && !selectedProject && !projectsQuery.loading);
  const updateFilters = (next: Partial<PlanningFilters>) => setFilters((current) => ({ ...current, ...next }));
  const refresh = () => { tasksQuery.retry(); projectsQuery.retry(); };

  return (
    <section className="min-w-0 space-y-5 text-[var(--ink)]" aria-label="Planificación de consulta">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="h-5 w-5 shrink-0 text-[var(--brand)]" aria-hidden="true" />Planificación</h2>
            <p className="text-sm text-[var(--muted)]">Consulta de tareas BuildOps autorizadas · solo lectura.</p>
          </div>
          <button type="button" onClick={refresh} disabled={tasksQuery.loading || projectsQuery.loading} className={`${linkClass} disabled:opacity-60`}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />Actualizar
          </button>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Abrir módulos existentes">
          <Link href="/buildops/tasks" className={linkClass}><CheckSquare className="h-4 w-4" aria-hidden="true" />Abrir tareas<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
          <Link href="/buildops/milestones" className={linkClass}><Flag className="h-4 w-4" aria-hidden="true" />Abrir hitos<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
        </nav>
        <p className="text-xs text-[var(--muted)]">Abren otro módulo. No se editan fechas ni estados aquí; los hitos no reciben fechas de tareas.</p>
      </header>

      {projectsQuery.loading && <PanelState title="Consultando proyectos autorizados…" loading />}
      {projectsQuery.error && <PanelState
        title={isWorkspaceAccessError(projectsQuery.error, projectsQuery.status) ? "Sin acceso a proyectos" : "No se pudieron consultar los proyectos"}
        description="El filtro por proyecto y su detalle no están disponibles. Las tareas se consultan de forma independiente."
        error onRetry={projectsQuery.retry}
      />}
      {!projectsQuery.loading && !projectsQuery.error && projects.length === 0 && <PanelState title="Sin proyectos autorizados disponibles" description="Puedes consultar las tareas obtenidas y filtrar las que no tienen proyecto." />}

      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <label className="min-w-0 space-y-1 text-sm">
          <span className="block text-[var(--muted)]">Proyecto BuildOps</span>
          <select className={controlClass} value={filters.projectId ?? ""} disabled={projectsQuery.loading || Boolean(projectsQuery.error)} onChange={(event) => updateFilters({ projectId: event.target.value })}>
            <option value="">Todos los proyectos</option>
            <option value="unassigned">Sin proyecto</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select>
        </label>
        <label className="min-w-0 space-y-1 text-sm">
          <span className="block text-[var(--muted)]">Estado</span>
          <select className={controlClass} value={filters.status ?? ""} onChange={(event) => updateFilters({ status: event.target.value as PlanningFilters["status"] })}>
            <option value="">Todos los estados</option>
            {Object.entries(PLANNING_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="min-w-0 space-y-1 text-sm">
          <span className="block text-[var(--muted)]">Prioridad</span>
          <select className={controlClass} value={filters.priority ?? ""} onChange={(event) => updateFilters({ priority: event.target.value as PlanningFilters["priority"] })}>
            <option value="">Todas las prioridades</option>
            {Object.entries(PLANNING_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <button type="button" onClick={() => setFilters({})} className={linkClass}>Limpiar filtros</button>
      {selectedProject && <div className="min-w-0 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="break-words text-sm font-semibold">{selectedProject.title}</p>
        <p className="break-all text-xs text-[var(--muted)]">ID BuildOps: {selectedProject.id}</p>
        <p className="break-all text-xs text-[var(--muted)]">ID de proyecto canónico: {selectedProject.canonicalProjectId ?? "Sin vínculo canónico"}</p>
        <Link href={planningProjectHref(selectedProject)} className={linkClass}>Abrir detalle BuildOps<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
      </div>}
      {projectUnavailable && <PanelState title="El proyecto seleccionado ya no está disponible" description="Limpia los filtros o vuelve a consultar proyectos. No se conserva el detalle anterior." />}

      <p className="text-xs text-[var(--muted)]">Hoy se calcula desde medianoche en la zona local de este navegador. Próximas incluye hoy y todas las fechas futuras. Los grupos reflejan fechas, no cambios de estado; también incluyen tareas terminadas o canceladas según el filtro.</p>
      {tasksQuery.loading ? <PanelState title="Consultando tareas autorizadas…" loading /> : tasksQuery.error ? <PanelState
        title={isWorkspaceAccessError(tasksQuery.error, tasksQuery.status) ? "Sin acceso a tareas" : "No se pudieron consultar las tareas"}
        description={isWorkspaceAccessError(tasksQuery.error, tasksQuery.status) ? tasksQuery.error : "No se sustituyó el fallo por un listado vacío. Reintenta la consulta."}
        error onRetry={tasksQuery.retry}
      /> : filteredTasks.length === 0 ? <PanelState
        title={(tasksQuery.data?.length ?? 0) === 0 ? "Sin tareas autorizadas disponibles" : "Sin tareas para estos filtros"}
        description={(tasksQuery.data?.length ?? 0) === 0 ? "No se recibieron tareas de BuildOps para esta sesión." : "Prueba otro proyecto, estado o prioridad, o limpia los filtros."}
      /> : <div className="space-y-5" aria-live="polite">
        {([
          { key: "overdue", label: "Vencidas", hint: "Fecha anterior a hoy" },
          { key: "upcoming", label: "Próximas", hint: "Hoy y fechas futuras" },
          { key: "undated", label: "Sin fecha", hint: "Sin vencimiento utilizable; las fechas inválidas se indican por separado" },
        ] as const).map((group) => <section key={group.key} className="min-w-0 space-y-2" aria-label={group.label}>
          <h3 className="text-sm font-semibold">{group.label} <span className="text-[var(--muted)]">({groups[group.key].length})</span></h3>
          <p className="text-xs text-[var(--muted)]">{group.hint}</p>
          {groups[group.key].length === 0 ? <p className="text-sm text-[var(--muted)]">Sin tareas en este grupo.</p> : <ul className="min-w-0 space-y-3">
            {groups[group.key].map((task) => {
              const due = parsePlanningDueDate(task.dueDate);
              const project = projects.find((item) => item.id === task.projectId);
              const highlighted = task.status === "blocked" || task.priority === "urgent";
              return <li key={task.id} className={`min-w-0 space-y-3 rounded-xl border bg-[var(--surface)] p-4 ${highlighted ? "border-[var(--error)]" : "border-[var(--border)]"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="min-w-0 break-words text-sm font-semibold">{task.title}</h4>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={task.status === "blocked" ? "flex items-center gap-1 font-semibold text-[var(--error)]" : "text-[var(--muted)]"}>{task.status === "blocked" && <AlertCircle className="h-4 w-4" aria-hidden="true" />}{PLANNING_STATUS_LABELS[task.status] ?? task.status}</span>
                    <span className={task.priority === "urgent" ? "font-semibold text-[var(--error)]" : "text-[var(--muted)]"}>Prioridad: {PLANNING_PRIORITY_LABELS[task.priority] ?? task.priority}</span>
                  </div>
                </div>
                <p className="break-words text-xs text-[var(--muted)]">{task.projectId ? task.projectTitle ?? "Proyecto sin título disponible" : "Sin proyecto"}</p>
                <p className="text-sm text-[var(--muted)]">{due.kind === "valid" ? <>Vencimiento: <time dateTime={task.dueDate ?? undefined}>{due.date.toLocaleDateString("es")}</time></> : due.kind === "invalid" ? <span className="text-[var(--error)]">Fecha inválida · sin vencimiento utilizable</span> : "Sin fecha de vencimiento"}</p>
                <div className="flex flex-wrap gap-2">
                  <Link href={planningTaskHref(task)} className={linkClass}>Abrir tarea<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
                  {project && <Link href={planningProjectHref(project)} className={linkClass}>Abrir proyecto BuildOps<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>}
                </div>
              </li>;
            })}
          </ul>}
        </section>)}
      </div>}
    </section>
  );
}
