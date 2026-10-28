/**
 * Worker dashboard evidence badge: the BFF summary must count the required
 * milestone evidence the worker still has to upload, and never report an
 * all-clear it could not verify.
 * Run: node --experimental-strip-types --test tests/unit/worker-evidence-summary.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ASSIGNED_JOBS_PATH, computeWorkerEvidenceSummary, MAX_JOBS_SCANNED } from "../../apps/web/lib/worker-evidence-summary.ts";

type Responses = Record<string, unknown>;

function fetcher(responses: Responses, calls: string[] = []) {
  return async <T,>(path: string): Promise<T> => {
    calls.push(path);
    if (!(path in responses)) throw new Error(`unexpected path ${path}`);
    const value = responses[path];
    if (value instanceof Error) throw value;
    return value as T;
  };
}

test("reads the worker's assigned jobs, not every job visible to them", async () => {
  // GET /v1/jobs also returns jobs the worker only bid on (and lost): their milestones are not readable.
  const calls: string[] = [];
  await computeWorkerEvidenceSummary(fetcher({ [ASSIGNED_JOBS_PATH]: [] }, calls));
  assert.deepEqual(calls, ["/v1/time-tracker/jobs"]);
});

test("counts required missing/rejected/re-upload/archived items on active jobs only", async () => {
  const summary = await computeWorkerEvidenceSummary(fetcher({
    [ASSIGNED_JOBS_PATH]: [
      { id: "j-active", status: "in_progress" },
      { id: "j-accepted", status: "accepted" },
      { id: "j-posted", status: "posted" },
      { id: "j-done", status: "completed" },
    ],
    "/v1/jobs/j-active/milestones": [{ id: "m1" }, { id: "m2" }],
    "/v1/jobs/j-accepted/milestones": [{ id: "m3" }],
    "/v1/milestones/m1/evidence-items": [
      { status: "missing", required: true },
      { status: "approved", required: true },
      { status: "submitted", required: true },
      { status: "missing", required: false },
    ],
    "/v1/milestones/m2/evidence-items": [
      { status: "rejected", required: true },
      { status: "needs_reupload", required: true },
    ],
    "/v1/milestones/m3/evidence-items": [{ status: "archived", required: true }],
  }));
  assert.deepEqual(summary, { missingCount: 4, totalCount: 6, complete: true });
});

test("a failed milestone read marks the summary incomplete instead of an all-clear", async () => {
  const summary = await computeWorkerEvidenceSummary(fetcher({
    [ASSIGNED_JOBS_PATH]: [{ id: "j1", status: "IN_PROGRESS" }],
    "/v1/jobs/j1/milestones": [{ id: "m1" }],
    "/v1/milestones/m1/evidence-items": new Error("403"),
  }));
  assert.deepEqual(summary, { missingCount: 0, totalCount: 0, complete: false });
});

test("a failed jobs list propagates so the route answers with an error", async () => {
  await assert.rejects(computeWorkerEvidenceSummary(fetcher({ [ASSIGNED_JOBS_PATH]: new Error("401") })));
});

test("more active jobs than the scan limit marks the summary incomplete", async () => {
  const responses: Responses = {
    [ASSIGNED_JOBS_PATH]: Array.from({ length: MAX_JOBS_SCANNED + 1 }, (_, i) => ({ id: `j${i}`, status: "ACCEPTED" })),
  };
  for (let i = 0; i < MAX_JOBS_SCANNED; i++) responses[`/v1/jobs/j${i}/milestones`] = [];
  const summary = await computeWorkerEvidenceSummary(fetcher(responses));
  assert.equal(summary.complete, false);
});

test("BFF route uses the session-only fetcher, and the badge hides on errors or partial reads", () => {
  const route = readFileSync("apps/web/app/api/semse/worker/evidence-summary/route.ts", "utf8");
  assert.match(route, /fetchSemseDataForAuthenticatedRequest/);
  assert.doesNotMatch(route, /fetchSemseDataForRequest\b/);
  assert.doesNotMatch(route, /status=/);

  const badge = readFileSync("apps/web/components/semse/WorkerEvidenceSummary.tsx", "utf8");
  assert.match(badge, /\(missing === 0 && !complete\)\) return null/);
  assert.doesNotMatch(badge, /finally \{ setLoaded\(true\)/);
});
