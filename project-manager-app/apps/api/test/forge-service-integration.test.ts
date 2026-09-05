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
  return {
    async enqueue(input) {
      counter += 1;
      return { id: `agent-run-${counter}`, tenantId: input.actor.tenantId, orgId: input.actor.orgId, agentType: "forge" };
    }
  };
}

function makeFakeAuditService() {
  return { async append() {} };
}

function makeFakeLeaseService() {
  return {
    async acquire() {
      return { acquired: true };
    },
    async release() {}
  };
}

const actor = { tenantId: "tenant-1", orgId: "org-1", userId: "user-1", roles: [] };

test("executeTask's async branch marks the dispatched task 'running' immediately, not just on completion", async () => {
  const a = task({ id: "a" });
  const seedRun = run([a]);
  const repository = makeFakeRepository(seedRun);
  const service = new ForgeService(repository, makeFakeAdapter(), makeFakeAuditService(), makeFakeLeaseService());

  const outcome = await service.executeTask({ actor, runId: seedRun.id, taskId: "a", async: true, requestId: randomUUID() });

  const dispatchedTask = outcome.forgeRun.tasks.find((t) => t.id === "a");
  assert.equal(dispatchedTask.status, "running");

  // Confirms the GET .../tasks/runnable path (backed by listRunnableTasks)
  // correctly stops offering it once dispatched — this is the actual
  // observable symptom the missing "running" write caused.
  const runnable = await service.listRunnableTasks({ tenantId: actor.tenantId, runId: seedRun.id });
  assert.deepEqual(runnable, []);
});

test("addTask rejects an invalid dependency with a 400, not an unhandled 500", async () => {
  const seedRun = run([]);
  const repository = makeFakeRepository(seedRun);
  const service = new ForgeService(repository, makeFakeAdapter(), makeFakeAuditService(), makeFakeLeaseService());

  await assert.rejects(
    () =>
      service.addTask({
        actor,
        runId: seedRun.id,
        task: task({ id: "a", dependencies: ["missing"] }),
        requestId: randomUUID()
      }),
    (error) => {
      assert.equal(error.constructor.name, "BadRequestException");
      assert.match(error.message, /Invalid Forge task dependencies/);
      return true;
    }
  );
});

test("addTask succeeds despite a pre-existing dangling reference elsewhere in the run", async () => {
  const alreadyBroken = task({ id: "already-broken", dependencies: ["never-existed"] });
  const seedRun = run([alreadyBroken]);
  const repository = makeFakeRepository(seedRun);
  const service = new ForgeService(repository, makeFakeAdapter(), makeFakeAuditService(), makeFakeLeaseService());

  const result = await service.addTask({
    actor,
    runId: seedRun.id,
    task: task({ id: "new-task" }),
    requestId: randomUUID()
  });

  assert.deepEqual(
    result.tasks.map((t) => t.id),
    ["already-broken", "new-task"]
  );
});
