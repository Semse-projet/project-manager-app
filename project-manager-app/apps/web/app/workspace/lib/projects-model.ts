export type WorkspaceProject = {
  id: string;
  jobId: string | null;
  title: string;
  description: string | null;
  status: string;
  createdAt: string | null;
};

export type WorkspaceMilestone = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  sequence: number | null;
  dueDate: string | null;
  amount: number | null;
};

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const searchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();

export const PROJECT_STATUS_LABELS: Readonly<Record<string, string>> = {
  open: "Abierto",
  in_progress: "En curso",
  blocked: "Bloqueado",
  completed: "Completado",
  cancelled: "Cancelado",
};
export const MILESTONE_STATUS_LABELS: Readonly<Record<string, string>> = {
  draft: "Borrador",
  awaiting_review: "Listo",
  submitted: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
  paid: "Pagado",
};
export function projectStatusLabel(status: string): string {
  return (
    PROJECT_STATUS_LABELS[status.toLowerCase()] ??
    `Estado no reconocido (${status || "sin dato"})`
  );
}
export function milestoneStatusLabel(status: string): string {
  return (
    MILESTONE_STATUS_LABELS[status.toLowerCase()] ??
    `Estado no reconocido (${status || "sin dato"})`
  );
}

/** Preserve HTTP access status even when the API payload only names a permission. */
export function projectErrorMessage(error: unknown): string {
  const status =
    error && typeof error === "object" && "status" in error
      ? String(error.status)
      : "";
  return [
    status,
    error instanceof Error
      ? error.message
      : "No se pudo completar la consulta.",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Readers already unwrap the BFF envelope. Do not flatten arbitrary nested contracts. */
export function normalizeProjects(
  raw: unknown,
  jobs: readonly Record<string, unknown>[] = [],
): WorkspaceProject[] {
  if (!Array.isArray(raw)) throw new Error("Respuesta de proyectos inválida.");
  const jobsById = new Map(jobs.map((job) => [text(job.id), job]));
  return raw.map((value) => {
    const project = record(value);
    const id = text(project?.id);
    if (!project || !id) throw new Error("Proyecto sin identificador válido.");
    const jobId = text(project.jobId);
    const job = jobId ? jobsById.get(jobId) : undefined;
    return {
      id,
      jobId,
      title: text(job?.title) ?? text(project.title) ?? `Proyecto · ${id}`,
      description: text(job?.scope) ?? text(project.description),
      status: text(project.status)?.toLowerCase() ?? "",
      createdAt: text(project.createdAt),
    };
  });
}

/** Local presentation filter over an already authorized result, not an access policy. */
export function filterProjects(
  projects: readonly WorkspaceProject[],
  query = "",
  status = "all",
): WorkspaceProject[] {
  const needle = searchText(query);
  return projects.filter(
    (project) =>
      (status === "all" || project.status === status.toLowerCase()) &&
      (!needle ||
        searchText(
          [
            project.title,
            project.description ?? "",
            project.id,
            project.jobId ?? "",
            project.status,
            projectStatusLabel(project.status),
          ].join(" "),
        ).includes(needle)),
  );
}
export function resolveSelectedProject(
  projects: readonly WorkspaceProject[],
  id: string,
): WorkspaceProject | null {
  return projects.find((project) => project.id === id) ?? null;
}

/** Explicit aggregate kind: BuildOps.id is never a canonical Project.id. */
export function resolveProjectIds(
  kind: "canonical" | "buildops",
  source: Record<string, unknown>,
) {
  return {
    canonicalProjectId:
      kind === "canonical" ? text(source.id) : text(source.canonicalProjectId),
    jobId: text(source.jobId),
    buildOpsProjectId: kind === "buildops" ? text(source.id) : null,
  };
}

/** Existing helper does not encode its argument. Encode exactly once at this boundary. */
export async function readProjectMilestones(
  project: WorkspaceProject,
  reader: (encodedJobId: string) => Promise<Record<string, unknown>[]>,
): Promise<WorkspaceMilestone[]> {
  if (!project.jobId)
    throw new Error(
      "El proyecto no tiene un trabajo vinculado para consultar hitos.",
    );
  const raw = await reader(encodeURIComponent(project.jobId));
  if (!Array.isArray(raw)) throw new Error("Respuesta de hitos inválida.");
  return raw
    .map((value) => {
      const milestone = record(value);
      const id = text(milestone?.id);
      if (!milestone || !id || text(milestone.projectId) !== project.id) {
        throw new Error(
          "La respuesta de hitos no corresponde al proyecto seleccionado.",
        );
      }
      return {
        id,
        projectId: project.id,
        title: text(milestone.title) ?? "Hito sin título",
        status: text(milestone.status)?.toLowerCase() ?? "",
        sequence: finite(milestone.sequence),
        dueDate: text(milestone.dueDate),
        amount: finite(milestone.amount),
      };
    })
    .sort((a, b) => (a.sequence ?? Infinity) - (b.sequence ?? Infinity));
}
