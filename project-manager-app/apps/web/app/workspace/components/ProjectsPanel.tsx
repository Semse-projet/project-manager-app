"use client";

import { useCallback, useId, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FolderKanban, RefreshCw, Search } from "lucide-react";
import { fetchProjects, fetchJobs, fetchJobMilestones } from "../../semse-api";
import type { WorkspaceRole } from "../lib/workspace-model";
import {
  useWorkspaceQuery,
  isWorkspaceAccessError,
  getWorkspaceErrorStatus,
} from "../lib/use-workspace-query";
import { PanelState } from "./PanelState";
import {
  filterProjects,
  normalizeProjects,
  resolveSelectedProject,
  readProjectMilestones,
  projectStatusLabel,
  milestoneStatusLabel,
  projectErrorMessage,
  PROJECT_STATUS_LABELS,
} from "../lib/projects-model";

const control =
  "min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]";
const action =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]";

export function ProjectsPanel({ role }: { role: WorkspaceRole | null }) {
  if (!role)
    return (
      <PanelState
        title="Acceso no disponible"
        description="No se pudo resolver tu rol. No se consultaron proyectos ni hitos."
      />
    );
  return <AuthorizedProjectsPanel key={role} role={role} />;
}

function AuthorizedProjectsPanel({ role }: { role: WorkspaceRole }) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selection, setSelection] = useState<{
    role: WorkspaceRole | null;
    id: string;
  }>({ role: null, id: "" });
  const loadProjects = useCallback(async () => {
    try {
      const [projects, jobs] = await Promise.all([
        fetchProjects(),
        fetchJobs(),
      ]);
      return normalizeProjects(
        projects,
        jobs as unknown as Record<string, unknown>[],
      );
    } catch (error) {
      throw Object.assign(new Error(projectErrorMessage(error)), { status: getWorkspaceErrorStatus(error) });
    }
  }, []);
  const projects = useWorkspaceQuery(
    role ? `projects:${role}` : null,
    loadProjects,
  );
  const rows = filterProjects(projects.data ?? [], search, status);
  const selected =
    !projects.loading && !projects.error && selection.role === role
      ? resolveSelectedProject(rows, selection.id)
      : null;
  const loadMilestones = useCallback(async () => {
    if (!selected) throw new Error("Selecciona un proyecto autorizado.");
    try {
      return await readProjectMilestones(selected, fetchJobMilestones);
    } catch (error) {
      throw Object.assign(new Error(projectErrorMessage(error)), { status: getWorkspaceErrorStatus(error) });
    }
  }, [selected]);
  const milestones = useWorkspaceQuery(
    role && selected?.jobId
      ? `milestones:${role}:${selected.id}:${selected.jobId}`
      : null,
    loadMilestones,
  );

  const moduleHref =
    role === "client"
      ? "/client/projects"
      : role === "worker"
        ? "/worker/jobs"
        : "/buildops/projects";
  return (
    <section
      className="min-w-0 space-y-5 text-[var(--ink)]"
      aria-labelledby={`${id}-title`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={`${id}-title`}
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <FolderKanban
              className="h-5 w-5 text-[var(--brand)]"
              aria-hidden="true"
            />
            Proyectos e hitos
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Consulta de solo lectura. El módulo propietario valida el acceso a
            cada recurso.
          </p>
        </div>
        <Link href={moduleHref} className={action}>
          Abrir {role === "worker" ? "trabajos" : "proyectos"}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label htmlFor={`${id}-search`} className="min-w-0 space-y-2 text-sm">
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4" aria-hidden="true" />
            Buscar en proyectos autorizados
          </span>
          <input
            id={`${id}-search`}
            type="search"
            className={control}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, estado o referencia"
          />
        </label>
        <label htmlFor={`${id}-status`} className="min-w-0 space-y-2 text-sm">
          <span className="block">Estado del proyecto</span>
          <select
            id={`${id}-status`}
            className={control}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">Todos los estados</option>
            {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {projects.loading ? (
        <PanelState title="Cargando proyectos" loading />
      ) : projects.error ? (
        <PanelState
          title={
            isWorkspaceAccessError(projects.error, projects.status)
              ? "Sin acceso a los proyectos"
              : "No se pudieron consultar los proyectos"
          }
          description={projects.error}
          error
          onRetry={projects.retry}
        />
      ) : !projects.data?.length ? (
        <PanelState
          title="Sin proyectos autorizados"
          description="La consulta se completó y no devolvió proyectos disponibles para tu sesión."
        />
      ) : !rows.length ? (
        <PanelState
          title="Sin coincidencias"
          description="Prueba otra búsqueda o estado. No se amplía el acceso a otros proyectos."
        />
      ) : (
        <div className="space-y-4">
          <label htmlFor={`${id}-project`} className="block space-y-2 text-sm">
            <span className="block">Proyecto autorizado</span>
            <select
              id={`${id}-project`}
              className={control}
              value={selected?.id ?? ""}
              onChange={(event) =>
                setSelection({ role, id: event.target.value })
              }
            >
              <option value="">Selecciona un proyecto</option>
              {rows.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title} · {projectStatusLabel(project.status)}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <article className="min-w-0 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="break-words font-semibold">{selected.title}</h3>
                <span className="rounded-lg bg-[var(--brand-dim)] px-2 py-1 text-sm">
                  {projectStatusLabel(selected.status)}
                </span>
              </div>
              {selected.description && (
                <p className="break-words text-sm text-[var(--muted)]">
                  {selected.description}
                </p>
              )}
              <dl className="space-y-1 break-all text-xs text-[var(--muted)]">
                <div>
                  <dt className="inline font-medium">Project: </dt>
                  <dd className="inline">{selected.id}</dd>
                </div>
                <div>
                  <dt className="inline font-medium">Job vinculado: </dt>
                  <dd className="inline">
                    {selected.jobId ?? "No disponible"}
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                {role === "client" && (
                  <Link
                    className={action}
                    href={`/client/projects/${encodeURIComponent(selected.id)}`}
                  >
                    Detalle del proyecto
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
                {selected.jobId && role !== "admin" && (
                  <Link
                    className={action}
                    href={`/${role === "client" ? "client" : "worker"}/jobs/${encodeURIComponent(selected.jobId)}`}
                  >
                    Trabajo vinculado
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-semibold">Hitos del proyecto</h4>
                {selected.jobId && (
                  <button
                    type="button"
                    className={action}
                    onClick={milestones.retry}
                    disabled={milestones.loading}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Actualizar hitos
                  </button>
                )}
              </div>
              {!selected.jobId ? (
                <PanelState
                  title="Hitos no disponibles"
                  description="No existe un Job vinculado. No se usará el ID del proyecto como ID de trabajo."
                />
              ) : milestones.loading ? (
                <PanelState title="Cargando hitos" loading />
              ) : milestones.error ? (
                <PanelState
                  title={
                    isWorkspaceAccessError(milestones.error, milestones.status)
                      ? "Sin acceso a los hitos"
                      : "No se pudieron consultar los hitos"
                  }
                  description={milestones.error}
                  error
                  onRetry={milestones.retry}
                />
              ) : !milestones.data?.length ? (
                <PanelState
                  title="Sin hitos registrados"
                  description="La consulta del trabajo vinculado se completó sin hitos."
                />
              ) : (
                <ul className="space-y-2">
                  {milestones.data.map((milestone) => (
                    <li
                      key={milestone.id}
                      className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-3"
                    >
                      <span className="min-w-0 break-words text-sm">
                        {milestone.title}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {milestoneStatusLabel(milestone.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ) : (
            <PanelState
              title="Selecciona un proyecto"
              description="Los hitos se consultarán únicamente para su trabajo vinculado."
            />
          )}
        </div>
      )}
      {!projects.loading && !projects.error && (
        <button type="button" className={action} onClick={projects.retry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Actualizar proyectos
        </button>
      )}
    </section>
  );
}
