import { normalizeJobRecordStatus, type JobRecordStatus, type JobRecordView } from "@semse/schemas";
import { apiFetch } from "./client";

/**
 * GET /v1/jobs and GET /v1/jobs/:jobId run their response through
 * toVisibleJob() (apps/api/src/common/visible-response.ts), which uppercases
 * `status` (e.g. "posted" -> "POSTED") for display. apps/web only sees the
 * lowercase form because its BFF (app/api/semse/jobs/route.ts) already
 * applies normalizeJobRecordStatus() before forwarding to the browser.
 * Mobile has no BFF (talks to /v1 directly, see README.md) so it has to
 * apply the same normalization itself here, or every lowercase comparison
 * in the app (BIDDABLE_JOB_STATUSES, JOB_STATUS_LABEL lookups, etc.) would
 * silently never match against the real API.
 */
export async function fetchJobsList(status?: JobRecordStatus): Promise<JobRecordView[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const jobs = await apiFetch<JobRecordView[]>(`/v1/jobs${query}`);
  return jobs.map(normalizeJobRecordStatus);
}

export async function fetchJobDetail(jobId: string): Promise<JobRecordView> {
  const job = await apiFetch<JobRecordView>(`/v1/jobs/${encodeURIComponent(jobId)}`);
  return normalizeJobRecordStatus(job);
}
