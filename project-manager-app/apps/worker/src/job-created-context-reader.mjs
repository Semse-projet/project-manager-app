/**
 * Restricted, read-only projection for pricing/risk job.created handlers.
 * The API derived this Job from the currently fenced AgentRun's persisted event.
 * No claimToken, arbitrary URL, or session secret is passed to the handlers.
 */
export function createJobCreatedContextReader(projection, tenantId) {
  const job = projection?.job;
  if (!job || typeof job.id !== "string" || !job.id) {
    throw new Error("Claimed job.created context is missing its Job");
  }
  const jobRoute = `/v1/jobs/${encodeURIComponent(job.id)}`;
  return async function readJobCreatedContext(path, init = {}, options = {}) {
    if (init.method && init.method !== "GET") {
      throw new Error("Claimed job.created context is strictly read-only");
    }
    if (options.tenantId !== tenantId) {
      throw new Error("Claimed job.created context has a different tenant");
    }
    // A newly created Job need not have a Project: do not query global listings.
    if (path === `/v1/projects?jobId=${encodeURIComponent(job.id)}`) {
      return { data: [] };
    }
    if (path === jobRoute) return { data: job };
    if (path === jobRoute + "/milestones" || path === jobRoute + "/evidence") {
      return { data: [] };
    }
    // Trust may not exist for newly-created jobs; no score is fabricated.
    if (path === jobRoute + "/trust") return { data: null };
    throw new Error("Path unavailable in claimed job.created context");
  };
}
