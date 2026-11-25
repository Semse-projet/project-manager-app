import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizedJobId,
  claimedJobWhere,
  claimedProjectWhere,
  decideClaimedJobRead,
  projectClaimedJob,
} from "../../apps/api/src/modules/agents/claimed-job-context.ts";

const lease = {
  status: "RUNNING",
  workerId: "worker_a",
  attempts: 1,
  orgId: "org_client",
  tenantId: "tenant_a",
  inputJson: {
    eventType: "job.created",
    context: { jobId: "job_other", projectId: "proj_other" },
    eventPayload: { jobId: "job_event" },
  },
};

test("#1161: authorized job id ignores context overrides", () => {
  assert.deepEqual(authorizedJobId(lease.inputJson), { eventType: "job.created", jobId: "job_event" });
  assert.deepEqual(authorizedJobId({ eventType: "job.created", context: { jobId: "job_other" } }), {
    eventType: "job.created",
    jobId: "",
  });
});

test("#1161: a current lease projects only the event job inside its org", () => {
  const decision = decideClaimedJobRead({ run: lease, workerId: "worker_a", expectedAttempts: 1 });
  assert.equal(decision.ok, true);
  if (!decision.ok) return;
  assert.deepEqual(claimedJobWhere(decision), {
    id: "job_event",
    tenantId: "tenant_a",
    clientOrgId: "org_client",
  });
  assert.deepEqual(claimedProjectWhere(decision), { jobId: "job_event", tenantId: "tenant_a" });
});

test("#1161: negatives do not authorize a job read", () => {
  const cases: Array<[string, Parameters<typeof decideClaimedJobRead>[0]]> = [
    ["run_missing", { run: null, workerId: "worker_a", expectedAttempts: 1 }],
    ["lease_mismatch", { run: { ...lease, status: "COMPLETED" }, workerId: "worker_a", expectedAttempts: 1 }],
    ["lease_mismatch", { run: { ...lease, workerId: "worker_b" }, workerId: "worker_a", expectedAttempts: 1 }],
    ["lease_mismatch", { run: { ...lease, attempts: 2 }, workerId: "worker_a", expectedAttempts: 1 }],
    ["unowned_run", { run: { ...lease, orgId: null }, workerId: "worker_a", expectedAttempts: 1 }],
    ["unowned_run", { run: { ...lease, orgId: "  " }, workerId: "worker_a", expectedAttempts: 1 }],
    ["not_job_created", { run: { ...lease, inputJson: { eventType: "manual", eventPayload: { jobId: "job_event" } } }, workerId: "worker_a", expectedAttempts: 1 }],
    ["missing_job_id", { run: { ...lease, inputJson: { eventType: "job.created", eventPayload: { title: "no id" }, context: { jobId: "job_other" } } }, workerId: "worker_a", expectedAttempts: 1 }],
  ];
  for (const [reason, input] of cases) {
    const decision = decideClaimedJobRead(input);
    assert.equal(decision.ok, false, reason);
    if (!decision.ok) assert.equal(decision.reason, reason);
  }
});

test("#1161: projection keeps a missing project distinct and does not invent milestones", () => {
  const absent = projectClaimedJob({
    id: "job_event", title: "Panel", scope: "Replace the panel and document the closeout for approval.",
    category: "electrical", status: "PUBLISHED", urgency: "normal",
    budgetMin: { toNumber: () => 1200 }, budgetMax: "2400",
  }, null);
  assert.equal(absent.projectPresence, "absent");
  assert.equal(absent.projectId, null);
  assert.equal(absent.job.budgetMin, 1200);
  assert.equal(absent.job.budgetMax, 2400);
  assert.equal("milestones" in absent, false);
  assert.equal("evidence" in absent, false);

  const present = projectClaimedJob(absent.job, "proj_1");
  assert.equal(present.projectPresence, "present");
  assert.equal(present.projectId, "proj_1");
});
