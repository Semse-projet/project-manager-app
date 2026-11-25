import test from "node:test";
import assert from "node:assert/strict";
import { AgentsRepository } from "../dist/modules/agents/agents.repository.js";

const actor = {
  tenantId: "tenant_a", orgId: "org_worker", userId: "usr_worker",
  runId: "run_1", workerId: "worker_a", expectedAttempts: 1,
};

function runningRow(overrides = {}) {
  return {
    status: "RUNNING",
    workerId: "worker_a",
    attempts: 1,
    orgId: "org_client",
    tenantId: "tenant_a",
    inputJson: {
      eventType: "job.created",
      context: { jobId: "job_other" },
      eventPayload: { jobId: "job_event" },
    },
    ...overrides,
  };
}

function repository(hooks: {
  queryRaw: () => Promise<unknown[]>;
  findJob: (args: { where: Record<string, string> }) => Promise<unknown>;
  findProject?: (args: { where: Record<string, string> }) => Promise<{ id: string } | null>;
}) {
  const tx = {
    $queryRaw: hooks.queryRaw,
    job: { findFirst: hooks.findJob },
    project: { findFirst: hooks.findProject ?? (async () => null) },
  };
  return new AgentsRepository({
    $transaction: async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx),
  } as never, { async ensureActorContext() {} } as never);
}

test("#1161: repository locks the run and reads only the event job in its org", async () => {
  const queries: unknown[] = [];
  const repo = repository({
    async queryRaw() {
      queries.push("lock");
      return [runningRow()];
    },
    async findJob(args) {
      queries.push(args.where);
      return {
        id: "job_event", title: "Panel", scope: "Replace the panel and document closeout.",
        category: "electrical", status: "PUBLISHED", urgency: "normal",
        budgetMin: { toNumber: () => 100 }, budgetMax: null,
      };
    },
    async findProject(args) {
      queries.push(args.where);
      return null;
    },
  });
  const result = await repo.readClaimedJobContext(actor);
  assert.equal(queries[0], "lock");
  assert.deepEqual(queries[1], { id: "job_event", tenantId: "tenant_a", clientOrgId: "org_client" });
  assert.deepEqual(queries[2], { jobId: "job_event", tenantId: "tenant_a" });
  assert.equal(result.projectPresence, "absent");
  assert.equal(result.job.budgetMin, 100);
  assert.equal(result.job.id, "job_event");
});

test("#1161: a stale lease does not read the job", async () => {
  let jobReads = 0;
  const repo = repository({
    async queryRaw() { return [runningRow({ attempts: 2 })]; },
    async findJob() { jobReads += 1; return null; },
  });
  await assert.rejects(() => repo.readClaimedJobContext(actor), /not found/);
  assert.equal(jobReads, 0);
});

test("#1161: a job outside the run organization is not returned", async () => {
  let where: Record<string, string> | undefined;
  const repo = repository({
    async queryRaw() { return [runningRow()]; },
    async findJob(args) {
      where = args.where;
      return null;
    },
  });
  await assert.rejects(() => repo.readClaimedJobContext(actor), /not found/);
  assert.deepEqual(where, { id: "job_event", tenantId: "tenant_a", clientOrgId: "org_client" });
});

test("#1161: a terminal run and a context-only job id do not read Job", async () => {
  for (const row of [
    runningRow({ status: "FAILED" }),
    runningRow({ workerId: "other" }),
    runningRow({ orgId: null }),
    runningRow({ inputJson: { eventType: "job.created", context: { jobId: "job_other" }, eventPayload: {} } }),
    runningRow({ inputJson: { eventType: "milestone.submitted", eventPayload: { jobId: "job_event" } } }),
  ]) {
    let jobReads = 0;
    const repo = repository({
      async queryRaw() { return [row]; },
      async findJob() { jobReads += 1; return null; },
    });
    await assert.rejects(() => repo.readClaimedJobContext(actor), /not found/);
    assert.equal(jobReads, 0);
  }
});
