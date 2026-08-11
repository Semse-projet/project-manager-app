import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { ForgeService } from "../dist/modules/forge/forge.service.js";

const approvedSpec = {
  id: "forge-test-spec",
  path: "docs/specs/forge/test.spec.md",
  digest: "abc123",
  status: "APPROVED"
};

function task(overrides = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    title: "Test task",
    spec: approvedSpec,
    requestedRole: "documentation-curator",
    riskLevel: "low",
    objective: "Update documentation",
    allowedFiles: ["docs/**"],
    forbiddenFiles: [],
    allowedCommands: [],
    acceptanceCriteria: [],
    dependencies: [],
    targetBranch: "agent/forge-docs",
    environment: "sandbox",
    metadata: {},
    status: "pending",
    ...overrides
  };
}

function run(tasks) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title: "Test run",
    state: "building",
    spec: approvedSpec,
    tasks,
    assignedAgents: {},
    approvals: [],
    events: [],
    agentRunIds: [],
    createdAt: now,
    updatedAt: now
  };
}

// Minimal fakes for ForgeService's dependencies.
function makeFakeRepository(seedRun) {
  const store = new Map([[seedRun.id, seedRun]]);
  return {
    async findById(input) {
      const found = store.get(input.runId);
      if (!found) throw new Error(`Forge run '${input.runId}' not found`);
      return structuredClone(found);
    },
    async update(input) {
      store.set(input.run.id, structuredClone(input.run));
      return structuredClone(input.run);
    }
  };
}

function makeFakeAdapter() {
  let counter = 0;
  const enqueued = [];
  return {
    enqueued,
    async enqueue(input) {
      counter += 1;
      const agentRunId = `agent-run-${counter}`;
      enqueued.push({ taskId: input.task.id, agentRunId });
      return { id: agentRunId, tenantId: input.actor.tenantId, orgId: input.actor.orgId, agentType: "forge" };
    }
  };
}

function makeFakeAuditService() {
  return { async append() {} };
}

// dispatchNext() now locks its select-and-dispatch sequence with
// leaseService.acquire()/release() (a plain per-run mutual-exclusion lock,
// not a sensitive-resource-category lease) — this fake mirrors just enough
// of ForgeLeaseService's SET-NX-style semantics for that to work in tests.
function makeFakeLeaseService() {
  const held = new Map();
  return {
    async acquire({ category, runId, taskId }) {
      if (held.has(category)) return { acquired: false, heldBy: held.get(category) };
      held.set(category, { runId, taskId });
      return { acquired: true };
    },
    async release({ category, runId, taskId }) {
      const owner = held.get(category);
      if (owner && owner.runId === runId && owner.taskId === taskId) {
        held.delete(category);
      }
    }
  };
}

const actor = { tenantId: "tenant-1", orgId: "org-1", userId: "user-1", roles: [] };

test("dispatchNext respects the concurrency cap and priority order", async () => {
  const high = task({ id: "high", priority: 1 });
  const medium = task({ id: "medium", priority: 5 });
  const low = task({ id: "low", priority: 10 });
  const seedRun = run([low, high, medium]);

  const adapter = makeFakeAdapter();
  const service = new ForgeService(makeFakeRepository(seedRun), adapter, makeFakeAuditService(), makeFakeLeaseService());

  const result = await service.dispatchNext({
    actor,
    runId: seedRun.id,
    maxConcurrentPerRun: 2,
    requestId: randomUUID()
  });

  assert.equal(result.dispatched.length, 2);
  assert.deepEqual(
    result.dispatched.map((d) => d.taskId),
    ["high", "medium"]
  );
  assert.deepEqual(
    adapter.enqueued.map((e) => e.taskId),
    ["high", "medium"]
  );
});

test("dispatchNext dispatches nothing when the run has no runnable tasks", async () => {
  const alreadyRunning = task({ id: "a", status: "running" });
  const seedRun = run([alreadyRunning]);
  const adapter = makeFakeAdapter();
  const service = new ForgeService(makeFakeRepository(seedRun), adapter, makeFakeAuditService(), makeFakeLeaseService());

  const result = await service.dispatchNext({ actor, runId: seedRun.id, requestId: randomUUID() });

  assert.deepEqual(result.dispatched, []);
  assert.deepEqual(adapter.enqueued, []);
});

test("dispatchNext does not dispatch a task whose dependency hasn't succeeded", async () => {
  const blocker = task({ id: "blocker", status: "pending" });
  const dependent = task({ id: "dependent", status: "pending", dependencies: ["blocker"] });
  const seedRun = run([blocker, dependent]);
  const adapter = makeFakeAdapter();
  const service = new ForgeService(makeFakeRepository(seedRun), adapter, makeFakeAuditService(), makeFakeLeaseService());

  const result = await service.dispatchNext({
    actor,
    runId: seedRun.id,
    maxConcurrentPerRun: 5,
    requestId: randomUUID()
  });

  assert.deepEqual(
    result.dispatched.map((d) => d.taskId),
    ["blocker"]
  );
});

test("dispatchNext marks each dispatched task 'running' so a second call doesn't re-dispatch it", async () => {
  // maxConcurrentPerRun: 2 with one task already "running" leaves capacity
  // for exactly one more — if the first call's dispatch of "a" weren't
  // persisted as "running", this second call would see 0 running and
  // capacity 2, re-dispatching "a" alongside "b" instead of just "b".
  const a = task({ id: "a", priority: 1 });
  const b = task({ id: "b", priority: 2 });
  const seedRun = run([a, b]);
  const adapter = makeFakeAdapter();
  const repository = makeFakeRepository(seedRun);
  const service = new ForgeService(repository, adapter, makeFakeAuditService(), makeFakeLeaseService());

  const first = await service.dispatchNext({
    actor,
    runId: seedRun.id,
    maxConcurrentPerRun: 1,
    requestId: randomUUID()
  });
  assert.deepEqual(
    first.dispatched.map((d) => d.taskId),
    ["a"]
  );

  const second = await service.dispatchNext({
    actor,
    runId: seedRun.id,
    maxConcurrentPerRun: 2,
    requestId: randomUUID()
  });
  assert.deepEqual(
    second.dispatched.map((d) => d.taskId),
    ["b"]
  );
});

test("dispatchNext rejects a concurrent call for the same run while one is already in flight", async () => {
  const a = task({ id: "a", priority: 1 });
  const seedRun = run([a]);
  const repository = makeFakeRepository(seedRun);
  const leaseService = makeFakeLeaseService();

  // Adapter that blocks mid-dispatch until the test releases it, so a
  // second dispatchNext() call can genuinely overlap the first instead of
  // just running sequentially.
  let releaseEnqueue;
  const blockedUntilReleased = new Promise((resolve) => {
    releaseEnqueue = resolve;
  });
  const adapter = {
    enqueued: [],
    async enqueue(input) {
      await blockedUntilReleased;
      const agentRunId = "agent-run-1";
      this.enqueued.push({ taskId: input.task.id, agentRunId });
      return { id: agentRunId, tenantId: input.actor.tenantId, orgId: input.actor.orgId, agentType: "forge" };
    }
  };
  const service = new ForgeService(repository, adapter, makeFakeAuditService(), leaseService);

  const firstCall = service.dispatchNext({ actor, runId: seedRun.id, requestId: randomUUID() });

  await assert.rejects(
    () => service.dispatchNext({ actor, runId: seedRun.id, requestId: randomUUID() }),
    /already in progress/
  );

  releaseEnqueue();
  const first = await firstCall;
  assert.deepEqual(
    first.dispatched.map((d) => d.taskId),
    ["a"]
  );
});

test("dispatchNext reports 503 (not 409) when the lock coordinator itself is unavailable", async () => {
  const a = task({ id: "a", priority: 1 });
  const seedRun = run([a]);
  const repository = makeFakeRepository(seedRun);
  const adapter = makeFakeAdapter();
  // Simulates ForgeLeaseService failing closed on a Redis outage — distinct
  // from "held by another dispatch," which the lock category alone can't tell apart.
  const leaseService = {
    async acquire() {
      return { acquired: false, reason: "lease_coordination_unavailable" };
    },
    async release() {}
  };
  const service = new ForgeService(repository, adapter, makeFakeAuditService(), leaseService);

  await assert.rejects(
    () => service.dispatchNext({ actor, runId: seedRun.id, requestId: randomUUID() }),
    /coordination unavailable/
  );
  assert.deepEqual(adapter.enqueued, []);
});

test("dispatchNext does not persist a stale task's re-invoked 'running' write over an already-succeeded status", async () => {
  const succeeded = task({ id: "a", status: "succeeded", priority: 1 });
  const seedRun = run([succeeded]);
  const repository = makeFakeRepository(seedRun);
  const adapter = makeFakeAdapter();
  const service = new ForgeService(repository, adapter, makeFakeAuditService(), makeFakeLeaseService());

  // dispatchNext()'s own selectDispatchable() wouldn't pick an already-
  // "succeeded" task, so exercise the guard directly through executeTask()
  // — the real path Forge uses to re-invoke a task with a later action.
  const outcome = await service.executeTask({ actor, runId: seedRun.id, taskId: "a", async: true, requestId: randomUUID() });
  const afterDispatch = outcome.forgeRun.tasks.find((t) => t.id === "a");
  assert.equal(afterDispatch.status, "succeeded");
});
