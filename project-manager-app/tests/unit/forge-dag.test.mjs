import test from "node:test";
import assert from "node:assert/strict";

import {
  ForgeHarness,
  createCreatorTaskPackets,
  dependenciesSucceeded,
  deriveTaskStatus,
  listRunnableTasks,
  validateTaskDependencies
} from "../../packages/forge/dist/index.js";

const approvedSpec = {
  id: "forge-test-spec",
  path: "docs/specs/forge/test.spec.md",
  digest: "abc123",
  status: "APPROVED"
};

const approvedCreatorSpec = {
  id: "creator-test-spec",
  path: "docs/specs/creator/apps/blueprint-1.spec.md",
  digest: "def456",
  status: "APPROVED"
};

const creatorBlueprint = {
  id: "blueprint-1",
  creatorId: "creator-1",
  creatorRole: "professor",
  title: "Test app",
  summary: "Test",
  domain: "test",
  audience: ["students"],
  appType: "course",
  learningObjectives: ["objective-1"],
  knowledgeSources: [],
  modules: [],
  assessments: [],
  monetization: { model: "free" },
  visibility: "private",
  dataClassification: "internal",
  languages: ["en"]
};

function task(overrides = {}) {
  return {
    id: "task-1",
    title: "Implement Forge docs",
    spec: approvedSpec,
    requestedRole: "documentation-curator",
    riskLevel: "low",
    objective: "Update documentation",
    allowedFiles: ["docs/**"],
    forbiddenFiles: ["packages/db/**"],
    allowedCommands: [],
    acceptanceCriteria: [],
    dependencies: [],
    targetBranch: "agent/forge-docs",
    environment: "sandbox",
    metadata: {},
    ...overrides
  };
}

function run(overrides = {}) {
  return {
    id: "run-1",
    title: "Test run",
    state: "building",
    spec: approvedSpec,
    tasks: [],
    assignedAgents: {},
    approvals: [],
    events: [],
    agentRunIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

test("validateTaskDependencies accepts a task with no dependencies", () => {
  const result = validateTaskDependencies([task()]);
  assert.deepEqual(result, { valid: true });
});

test("validateTaskDependencies accepts a real DAG (creator knowledge -> ux/backend -> verify)", () => {
  const tasks = createCreatorTaskPackets(creatorBlueprint, approvedCreatorSpec);
  const result = validateTaskDependencies(tasks);
  assert.deepEqual(result, { valid: true });
});

test("validateTaskDependencies rejects a reference to an unknown task", () => {
  const result = validateTaskDependencies([task({ id: "a", dependencies: ["missing"] })]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("unknown task 'missing'")));
});

test("validateTaskDependencies detects a direct cycle", () => {
  const a = task({ id: "a", dependencies: ["b"] });
  const b = task({ id: "b", dependencies: ["a"] });
  const result = validateTaskDependencies([a, b]);
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.ok(result.errors[0].includes("Dependency cycle detected"));
});

test("validateTaskDependencies detects an indirect (3-node) cycle", () => {
  const a = task({ id: "a", dependencies: ["c"] });
  const b = task({ id: "b", dependencies: ["a"] });
  const c = task({ id: "c", dependencies: ["b"] });
  const result = validateTaskDependencies([a, b, c]);
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
});

test("validateTaskDependencies does not flag a diamond-shaped DAG as a cycle", () => {
  const knowledge = task({ id: "knowledge", dependencies: [] });
  const ux = task({ id: "ux", dependencies: ["knowledge"] });
  const backend = task({ id: "backend", dependencies: ["knowledge"] });
  const verify = task({ id: "verify", dependencies: ["ux", "backend"] });
  const result = validateTaskDependencies([knowledge, ux, backend, verify]);
  assert.deepEqual(result, { valid: true });
});

test("listRunnableTasks returns a task with no dependencies and pending status", () => {
  const runnable = listRunnableTasks([task({ id: "a", status: "pending" })]);
  assert.deepEqual(runnable.map((t) => t.id), ["a"]);
});

test("listRunnableTasks excludes a task whose dependency has not succeeded", () => {
  const a = task({ id: "a", status: "pending" });
  const b = task({ id: "b", status: "pending", dependencies: ["a"] });
  const runnable = listRunnableTasks([a, b]);
  assert.deepEqual(runnable.map((t) => t.id), ["a"]);
});

test("listRunnableTasks includes a task once its dependency has succeeded", () => {
  const a = task({ id: "a", status: "succeeded" });
  const b = task({ id: "b", status: "pending", dependencies: ["a"] });
  const runnable = listRunnableTasks([a, b]);
  assert.deepEqual(runnable.map((t) => t.id), ["b"]);
});

test("listRunnableTasks excludes a task blocked on a failed dependency", () => {
  const a = task({ id: "a", status: "failed" });
  const b = task({ id: "b", status: "pending", dependencies: ["a"] });
  const runnable = listRunnableTasks([a, b]);
  assert.deepEqual(runnable, []);
});

test("listRunnableTasks excludes a task that is already running or succeeded", () => {
  const running = task({ id: "a", status: "running" });
  const succeeded = task({ id: "b", status: "succeeded" });
  const runnable = listRunnableTasks([running, succeeded]);
  assert.deepEqual(runnable, []);
});

test("listRunnableTasks treats a task with no status as pending", () => {
  const runnable = listRunnableTasks([task({ id: "a", status: undefined })]);
  assert.deepEqual(runnable.map((t) => t.id), ["a"]);
});

test("dependenciesSucceeded is true for a task with no dependencies regardless of its own status", () => {
  for (const status of ["pending", "running", "succeeded", "failed", "blocked_on_approval"]) {
    assert.equal(dependenciesSucceeded(task({ id: "a", status, dependencies: [] }), [task({ id: "a", status })]), true);
  }
});

test("dependenciesSucceeded ignores the task's own status — unlike listRunnableTasks, an already-succeeded task with satisfied dependencies still passes", () => {
  // This is the exact distinction executeTask's guard relies on: Forge
  // re-invokes the same task multiple times with different actions
  // (prPackage, then deployment.propose, ...), so a task already marked
  // "succeeded" from an earlier action must still pass this check.
  const blocker = task({ id: "blocker", status: "succeeded" });
  const alreadySucceeded = task({ id: "b", status: "succeeded", dependencies: ["blocker"] });
  assert.equal(dependenciesSucceeded(alreadySucceeded, [blocker, alreadySucceeded]), true);
  assert.deepEqual(listRunnableTasks([blocker, alreadySucceeded]), []);
});

test("dependenciesSucceeded is false when a dependency hasn't succeeded", () => {
  const blocker = task({ id: "blocker", status: "pending" });
  const dependent = task({ id: "b", status: "pending", dependencies: ["blocker"] });
  assert.equal(dependenciesSucceeded(dependent, [blocker, dependent]), false);
});

test("deriveTaskStatus returns the existing status unchanged when already set", () => {
  const t = task({ status: "running" });
  assert.equal(deriveTaskStatus(t, run({ tasks: [t] })), "running");
});

test("deriveTaskStatus infers 'pending' for a legacy task with no events", () => {
  const t = task({ status: undefined });
  assert.equal(deriveTaskStatus(t, run({ tasks: [t] })), "pending");
});

test("deriveTaskStatus infers 'succeeded' when the task's agentRunId is registered on the run", () => {
  const t = task({ id: "a", status: undefined });
  const theRun = run({
    tasks: [t],
    agentRunIds: ["agent-run-1"],
    events: [
      {
        id: "evt-1",
        type: "FORGE_TASK_QUEUED",
        runId: "run-1",
        timestamp: new Date().toISOString(),
        actor: "actor-1",
        detail: { taskId: "a", agentRunId: "agent-run-1" }
      }
    ]
  });
  assert.equal(deriveTaskStatus(t, theRun), "succeeded");
});

test("deriveTaskStatus infers 'running' when assigned/queued but not yet registered as completed", () => {
  const t = task({ id: "a", status: undefined });
  const theRun = run({
    tasks: [t],
    agentRunIds: [],
    events: [
      {
        id: "evt-1",
        type: "FORGE_TASK_QUEUED",
        runId: "run-1",
        timestamp: new Date().toISOString(),
        actor: "actor-1",
        detail: { taskId: "a", agentRunId: "agent-run-1" }
      }
    ]
  });
  assert.equal(deriveTaskStatus(t, theRun), "running");
});

test("deriveTaskStatus infers 'failed' when the last event for the task was a run-blocked denial", () => {
  const t = task({ id: "a", status: undefined });
  const theRun = run({
    tasks: [t],
    events: [
      {
        id: "evt-1",
        type: "FORGE_RUN_BLOCKED",
        runId: "run-1",
        timestamp: new Date().toISOString(),
        actor: "actor-1",
        detail: { taskId: "a" }
      }
    ]
  });
  assert.equal(deriveTaskStatus(t, theRun), "failed");
});

test("ForgeHarness.addTask rejects a task that depends on itself", () => {
  // A two-task a<->b cycle can't be built incrementally through addTask:
  // each call validates immediately, so the second half of any cycle always
  // fails as a "missing reference" first (b doesn't exist yet when a->b is
  // added) — genuine multi-task cycles are only reachable via
  // validateTaskDependencies() on a full task list at once (covered above).
  // A single-task self-reference is the one cycle shape addTask can hit.
  const harness = new ForgeHarness();
  const created = harness.createRun({ title: "Cycle test", spec: approvedSpec });
  assert.throws(
    () => harness.addTask(created.id, task({ id: "a", dependencies: ["a"] })),
    /Invalid Forge task dependencies/
  );
});

test("ForgeHarness.addTask rejects a reference to a nonexistent task", () => {
  const harness = new ForgeHarness();
  const created = harness.createRun({ title: "Missing ref test", spec: approvedSpec });
  assert.throws(
    () => harness.addTask(created.id, task({ id: "a", dependencies: ["missing"] })),
    /Invalid Forge task dependencies/
  );
});

test("ForgeHarness.addTask tolerates a PRE-EXISTING dangling reference elsewhere in the run", () => {
  // dependencies went unvalidated before this phase, so a run persisted
  // earlier could already contain a dangling reference. addTask() must not
  // permanently brick further task creation on that run over data this
  // specific call had no part in creating — loadRun() bypasses validation,
  // simulating exactly that kind of already-persisted legacy state.
  const harness = new ForgeHarness();
  const legacyRun = {
    id: "legacy-run",
    title: "Legacy run",
    state: "building",
    spec: approvedSpec,
    tasks: [task({ id: "already-broken", dependencies: ["never-existed"] })],
    assignedAgents: {},
    approvals: [],
    events: [],
    agentRunIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  harness.loadRun(legacyRun);

  const updated = harness.addTask("legacy-run", task({ id: "new-task", dependencies: [] }));
  assert.deepEqual(
    updated.tasks.map((t) => t.id),
    ["already-broken", "new-task"]
  );
});

test("ForgeHarness.addTask still rejects the NEW task referencing something nonexistent, even alongside a pre-existing dangling reference", () => {
  const harness = new ForgeHarness();
  const legacyRun = {
    id: "legacy-run-2",
    title: "Legacy run",
    state: "building",
    spec: approvedSpec,
    tasks: [task({ id: "already-broken", dependencies: ["never-existed"] })],
    assignedAgents: {},
    approvals: [],
    events: [],
    agentRunIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  harness.loadRun(legacyRun);

  assert.throws(
    () => harness.addTask("legacy-run-2", task({ id: "new-task", dependencies: ["also-missing"] })),
    /Invalid Forge task dependencies/
  );
});

test("ForgeHarness.assignTask rejects a task whose dependency has not succeeded", () => {
  const harness = new ForgeHarness();
  const created = harness.createRun({ title: "Assign test", spec: approvedSpec });
  harness.addTask(created.id, task({ id: "a", status: "pending" }));
  harness.addTask(created.id, task({ id: "b", status: "pending", dependencies: ["a"] }));
  assert.throws(
    () => harness.assignTask(created.id, "b", "documentation-curator"),
    /unmet dependencies/
  );
});

test("ForgeHarness.assignTask succeeds once the dependency is marked succeeded", () => {
  const harness = new ForgeHarness();
  const created = harness.createRun({ title: "Assign test 2", spec: approvedSpec });
  harness.addTask(created.id, task({ id: "a", status: "succeeded" }));
  harness.addTask(created.id, task({ id: "b", status: "pending", dependencies: ["a"] }));
  const updated = harness.assignTask(created.id, "b", "documentation-curator");
  assert.deepEqual(updated.assignedAgents["documentation-curator"], ["b"]);
});

test("ForgeHarness.listRunnableTasks reflects dependency state", () => {
  const harness = new ForgeHarness();
  const created = harness.createRun({ title: "Runnable test", spec: approvedSpec });
  harness.addTask(created.id, task({ id: "a", status: "pending" }));
  harness.addTask(created.id, task({ id: "b", status: "pending", dependencies: ["a"] }));
  const runnable = harness.listRunnableTasks(created.id);
  assert.deepEqual(runnable.map((t) => t.id), ["a"]);
});
