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

// Minimal fakes — dispatchNext()'s async dispatch path never reaches
// applyTaskResult() (that only runs on the sync path or on completeTask()),
// so the lease service is never actually called; it just needs to exist to
// satisfy ForgeService's constructor.
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

const actor = { tenantId: "tenant-1", orgId: "org-1", userId: "user-1", roles: [] };

test("dispatchNext respects the concurrency cap and priority order", async () => {
  const high = task({ id: "high", priority: 1 });
  const medium = task({ id: "medium", priority: 5 });
  const low = task({ id: "low", priority: 10 });
  const seedRun = run([low, high, medium]);

  const adapter = makeFakeAdapter();
  const service = new ForgeService(makeFakeRepository(seedRun), adapter, makeFakeAuditService(), {});

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
  const service = new ForgeService(makeFakeRepository(seedRun), adapter, makeFakeAuditService(), {});

  const result = await service.dispatchNext({ actor, runId: seedRun.id, requestId: randomUUID() });

  assert.deepEqual(result.dispatched, []);
  assert.deepEqual(adapter.enqueued, []);
});

test("dispatchNext does not dispatch a task whose dependency hasn't succeeded", async () => {
  const blocker = task({ id: "blocker", status: "pending" });
  const dependent = task({ id: "dependent", status: "pending", dependencies: ["blocker"] });
  const seedRun = run([blocker, dependent]);
  const adapter = makeFakeAdapter();
  const service = new ForgeService(makeFakeRepository(seedRun), adapter, makeFakeAuditService(), {});

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
  const service = new ForgeService(repository, adapter, makeFakeAuditService(), {});

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
