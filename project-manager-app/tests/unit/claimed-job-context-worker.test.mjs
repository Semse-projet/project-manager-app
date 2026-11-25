import test from "node:test";
import assert from "node:assert/strict";
import { loadClaimedJobContext, shouldLoadClaimedJobContext } from "../../apps/worker/src/claimed-job-context.mjs";

test("#1161: worker core sends the claim token only on the fenced call and checks the job id", async () => {
  const secret = "a".repeat(43);
  const calls = [];
  const run = {
    id: "run_1",
    agentType: "pricing",
    tenantId: "tenant_a",
    input: { eventType: "job.created", eventPayload: { jobId: "job_event" }, context: { jobId: "job_other" } },
  };
  assert.equal(shouldLoadClaimedJobContext(run), true);
  assert.equal(shouldLoadClaimedJobContext({ ...run, agentType: "risk" }), true);
  assert.equal(shouldLoadClaimedJobContext({ ...run, agentType: "field-ops" }), false);
  assert.equal(shouldLoadClaimedJobContext({ ...run, input: { eventType: "manual", eventPayload: { jobId: "job_event" } } }), false);

  const snapshot = await loadClaimedJobContext({
    run,
    claimToken: secret,
    workerId: "worker_a",
    expectedAttempts: 1,
    tenantId: "tenant_a",
    requestJson: async (path, init) => {
      calls.push({ path, body: JSON.parse(init.body) });
      return { data: { job: { id: "job_event", title: "Panel", scope: "x", budgetMin: 10, budgetMax: 20 }, projectId: null, projectPresence: "absent" } };
    },
  });
  assert.equal(calls[0].path, "/v1/agents/runs/run_1/claimed-job-context");
  assert.equal(calls[0].body.claimToken, secret);
  assert.equal(calls[0].body.jobId, undefined);
  assert.equal(JSON.stringify(snapshot).includes(secret), false);
  assert.equal(snapshot.job.id, "job_event");

  await assert.rejects(() => loadClaimedJobContext({
    run,
    claimToken: secret,
    workerId: "worker_a",
    expectedAttempts: 1,
    tenantId: "tenant_a",
    requestJson: async () => ({ data: { job: { id: "job_other" }, projectPresence: "absent" } }),
  }), /did not match/);
});
