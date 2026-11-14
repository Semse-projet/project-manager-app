// Vista reducida de un proyecto canónico (`/v1/projects/:id` + su trabajo) con la forma
// que usa el detalle del cliente. Los campos que el trabajo no aporta quedan vacíos.

export type CanonicalProjectViewFields = {
  id: string;
  tenantId: string;
  jobId: string | null;
  canonicalProjectId: string;
  title: string;
  description: string | null;
  trade: string;
  location: string;
  budgetEstimate: number | null;
};

type Loose = Record<string, unknown> | null | undefined;

const text = (value: unknown, fallback: string) =>
  typeof value === "string" && value ? value : fallback;

export function buildCanonicalProjectView(
  project: Loose,
  job: Loose,
): CanonicalProjectViewFields | null {
  if (!project || typeof project.id !== "string" || !project.id.trim())
    return null;
  if (typeof job?.id === "string" && job.id !== project.jobId) return null;
  const budgetMax =
    typeof job?.budgetMax === "number" && Number.isFinite(job.budgetMax)
      ? job.budgetMax
      : null;
  const budgetMin =
    typeof job?.budgetMin === "number" && Number.isFinite(job.budgetMin)
      ? job.budgetMin
      : null;
  return {
    id: project.id,
    tenantId: text(project.tenantId, ""),
    jobId: typeof project.jobId === "string" ? project.jobId : null,
    canonicalProjectId: project.id,
    title: text(job?.title, text(project.title, "Proyecto")),
    description: typeof job?.scope === "string" && job.scope ? job.scope : null,
    trade: text(job?.category, "—"),
    location: text(job?.location, "—"),
    budgetEstimate: budgetMax ?? budgetMin,
  };
}
