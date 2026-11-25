/**
 * Fenced read for a claimed `job.created` AgentRun (#1161).
 *
 * AGENT_RUNNER does not have `projects:read` or `jobs:read`. The worker may
 * read only the Job already stored on the run it holds, and only while that
 * lease is current. A `context.jobId` on the same input must not redirect it.
 */

export type ClaimedJobRejection =
  | "run_missing"
  | "lease_mismatch"
  | "unowned_run"
  | "not_job_created"
  | "missing_job_id";

export type ClaimedJobDecision =
  | { ok: false; reason: ClaimedJobRejection }
  | { ok: true; jobId: string; tenantId: string; orgId: string };

export type ClaimedJobProjection = {
  job: {
    id: string;
    title: string;
    scope: string;
    category: string | null;
    status: string;
    urgency: string | null;
    budgetMin: number | null;
    budgetMax: number | null;
  };
  projectId: string | null;
  projectPresence: "present" | "absent";
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asNonEmptyString(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

export function jsonNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    const parsed = value.toNumber();
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Job id comes only from the persisted domain event, never from `input.context`. */
export function authorizedJobId(inputJson: unknown): { eventType: string; jobId: string } {
  const input = asRecord(inputJson);
  const payload = asRecord(input.eventPayload);
  return {
    eventType: asNonEmptyString(input.eventType),
    jobId: asNonEmptyString(payload.jobId),
  };
}

export function decideClaimedJobRead(input: {
  run: {
    status: string;
    workerId: string | null;
    attempts: number;
    orgId: string | null;
    tenantId: string;
    inputJson: unknown;
  } | null;
  workerId: string;
  expectedAttempts: number;
}): ClaimedJobDecision {
  const run = input.run;
  if (!run) return { ok: false, reason: "run_missing" };
  if (run.status !== "RUNNING" || run.workerId !== input.workerId || run.attempts !== input.expectedAttempts) {
    return { ok: false, reason: "lease_mismatch" };
  }
  const orgId = asNonEmptyString(run.orgId);
  if (!orgId) return { ok: false, reason: "unowned_run" };
  const { eventType, jobId } = authorizedJobId(run.inputJson);
  if (eventType !== "job.created") return { ok: false, reason: "not_job_created" };
  if (!jobId) return { ok: false, reason: "missing_job_id" };
  return { ok: true, jobId, tenantId: run.tenantId, orgId };
}

export function claimedJobWhere(decision: Extract<ClaimedJobDecision, { ok: true }>) {
  return { id: decision.jobId, tenantId: decision.tenantId, clientOrgId: decision.orgId };
}

export function claimedProjectWhere(decision: Extract<ClaimedJobDecision, { ok: true }>) {
  return { jobId: decision.jobId, tenantId: decision.tenantId };
}

export function projectClaimedJob(
  job: {
    id: string;
    title: string;
    scope: string;
    category: string | null;
    status: string;
    urgency: string | null;
    budgetMin: unknown;
    budgetMax: unknown;
  },
  projectId: string | null,
): ClaimedJobProjection {
  return {
    job: {
      id: job.id,
      title: job.title,
      scope: job.scope,
      category: job.category,
      status: String(job.status),
      urgency: job.urgency,
      budgetMin: jsonNumber(job.budgetMin),
      budgetMax: jsonNumber(job.budgetMax),
    },
    projectId,
    projectPresence: projectId ? "present" : "absent",
  };
}
