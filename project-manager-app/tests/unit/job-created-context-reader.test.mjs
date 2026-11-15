import test from "node:test";
import assert from "node:assert/strict";
import { createJobCreatedContextReader, createClaimedJobCreatedHandlerRun } from "../../apps/worker/src/job-created-context-reader.mjs";
import { executeSpecializedWorkerRun } from "../../apps/worker/src/agent-run-handlers.mjs";

const tenantId = "tnt_context_test";
const jobId = "job-owned-123";
const projection = Object.freeze({
  job: {
    id: jobId, title: "Synthetic electrical work",
    scope: "Replace a test panel and record inspection evidence, only on a disposable system.",
    category: "electrical", status: "published", urgency: "low",
    budgetMin: null, budgetMax: null
  }
});
const logger = { info() {}, warn() {} };
const reader = () => createJobCreatedContextReader(projection, tenantId);

test("job.created context denies arbitrary Jobs, Projects and non-GET requests", async () => {
  const get = reader();
  await assert.rejects(
    get("/v1/jobs/job-from-another-org", { method: "GET" }, { tenantId }),
    /Path unavailable/
  );
  await assert.rejects(
    get("/v1/projects", { method: "GET" }, { tenantId }),
    /Path unavailable/
  );
  await assert.rejects(
    get("/v1/jobs/" + jobId, { method: "DELETE" }, { tenantId }),
    /strictly read-only/
  );
  await assert.rejects(
    get("/v1/jobs/" + jobId, { method: "GET" }, { tenantId: "other-tenant" }),
    /different tenant/
  );
  await assert.rejects(
    get("/v1/agents/runs/any/worker", { method: "GET" }, { tenantId }),
    /Path unavailable/
  );
});

test("job.created can exist without a Project; no arbitrary Project discovery", async () => {
  const get = reader();
  const projects = await get(
    "/v1/projects?jobId=" + encodeURIComponent(jobId),
    { method: "GET" }, { tenantId }
  );
  assert.deepEqual(projects.data, []);
  const job = await get("/v1/jobs/" + encodeURIComponent(jobId), { method: "GET" }, { tenantId });
  assert.equal(job.data.id, jobId);
  const trust = await get("/v1/jobs/" + encodeURIComponent(jobId) + "/trust", { method: "GET" }, { tenantId });
  assert.equal(trust.data, null);
});

test("pricing and risk consume only authorized persisted job.created projection", async () => {
  for (const agentType of ["pricing", "risk"]) {
    const run = {
      id: "synthetic-" + agentType, agentType, triggerType: "event",
      input: {
        eventType: "job.created",
        eventPayload: { jobId },
      },
    };
    const result = await executeSpecializedWorkerRun({
      run, requestJson: reader(), tenantId, logger, workerId: "worker-qa-1149",
    });
    assert.equal(result.result.jobId, jobId);
  }
});


test("job.created handler cannot override authorized Job via run.input/context", async () => {
  const hostileInput = {
    eventType: "job.created",
    jobId: "foreign-job",
    projectId: "foreign-project",
    eventPayload: { jobId, clientOrgId: "org_real" },
    context: {
      jobId: "foreign-job",
      projectId: "foreign-project",
      project: { jobId: "foreign-job", projectId: "foreign-project" },
    },
  };
  for (const agentType of ["pricing", "risk"]) {
    const run = {
      id: "conflict-" + agentType, agentType, triggerType: "event",
      input: hostileInput,
    };
    const securedRun = createClaimedJobCreatedHandlerRun(run, projection);
    assert.deepEqual(securedRun.input, {
      eventType: "job.created",
      eventPayload: { jobId },
      context: { jobId },
    });
    assert.equal(run.input.context.jobId, "foreign-job", "do not mutate persisted input");
    const touched = [];
    const requestJson = async (...args) => {
      touched.push(args[0]);
      return reader()(...args);
    };
    const result = await executeSpecializedWorkerRun({
      run: securedRun, requestJson, tenantId, logger,
      workerId: "worker-qa-1149",
    });
    assert.equal(result.result.jobId, jobId);
    assert.equal(result.result.projectId ?? null, null);
    assert.ok(touched.every(path => !path.includes("foreign-job") && !path.includes("foreign-project")));
  }
});

test("malformed projection fails closed", () => {
  for (const bad of [null, {}, { job: {} }, { job: { id: "" } }]) {
    assert.throws(() => createJobCreatedContextReader(bad, tenantId), /missing its Job/);
  }
});
