/**
 * Counts the required milestone evidence a worker still has to upload across
 * their active jobs. Pure: the BFF route injects the authenticated fetcher.
 *
 * "Pending" mirrors the API's payment gate (evaluateRequiredEvidence in
 * apps/api/src/modules/milestones/evidence-readiness.ts): only `required`
 * items count, and of those only the states the worker can fix by uploading.
 * `submitted` waits on the reviewer, so it is not the worker's to act on.
 */

export const ACTIVE_JOB_STATUSES = new Set(["RESERVED", "ACCEPTED", "IN_PROGRESS"]);
export const WORKER_ACTIONABLE_EVIDENCE_STATUSES = new Set(["missing", "rejected", "needs_reupload", "archived"]);
export const MAX_JOBS_SCANNED = 10;

export type WorkerEvidenceSummary = {
  missingCount: number;
  totalCount: number;
  /** False when a job or milestone could not be read: a zero is then not an all-clear. */
  complete: boolean;
};

type Fetcher = <T>(path: string) => Promise<T>;
type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((v): v is Row => typeof v === "object" && v !== null) : [];
}

function id(row: Row): string | null {
  return typeof row.id === "string" && row.id.length > 0 ? row.id : null;
}

function jobStatus(row: Row): string {
  return typeof row.status === "string" ? row.status.toUpperCase() : "";
}

export async function computeWorkerEvidenceSummary(fetchData: Fetcher): Promise<WorkerEvidenceSummary> {
  // GET /v1/jobs accepts one lowercase status, so filter the visible (uppercase) status here.
  const jobs = rows(await fetchData<unknown>("/v1/jobs"))
    .filter((job) => ACTIVE_JOB_STATUSES.has(jobStatus(job)))
    .map(id)
    .filter((jobId): jobId is string => jobId !== null);

  let missingCount = 0;
  let totalCount = 0;
  let complete = jobs.length <= MAX_JOBS_SCANNED;

  await Promise.all(jobs.slice(0, MAX_JOBS_SCANNED).map(async (jobId) => {
    let milestones: string[];
    try {
      milestones = rows(await fetchData<unknown>(`/v1/jobs/${encodeURIComponent(jobId)}/milestones`))
        .map(id)
        .filter((milestoneId): milestoneId is string => milestoneId !== null);
    } catch {
      complete = false;
      return;
    }
    await Promise.all(milestones.map(async (milestoneId) => {
      try {
        const items = rows(await fetchData<unknown>(`/v1/milestones/${encodeURIComponent(milestoneId)}/evidence-items`))
          .filter((item) => item.required !== false);
        totalCount += items.length;
        missingCount += items.filter((item) => WORKER_ACTIONABLE_EVIDENCE_STATUSES.has(String(item.status))).length;
      } catch {
        complete = false;
      }
    }));
  }));

  return { missingCount, totalCount, complete };
}
