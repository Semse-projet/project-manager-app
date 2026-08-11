import test from "node:test";
import assert from "node:assert/strict";

import { selectDispatchable } from "../../packages/forge/dist/index.js";

const approvedSpec = {
  id: "forge-test-spec",
  path: "docs/specs/forge/test.spec.md",
  digest: "abc123",
  status: "APPROVED"
};

function task(overrides = {}) {
  return {
    id: "task-1",
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

test("selectDispatchable returns an empty list when capacity is zero", () => {
  const result = selectDispatchable([task({ id: "a" })], { maxConcurrentPerRun: 2, currentlyRunning: 2 });
  assert.deepEqual(result, []);
});

test("selectDispatchable returns an empty list when over capacity", () => {
  const result = selectDispatchable([task({ id: "a" })], { maxConcurrentPerRun: 1, currentlyRunning: 3 });
  assert.deepEqual(result, []);
});

test("selectDispatchable orders by priority ascending (lower number first)", () => {
  const low = task({ id: "low", priority: 10 });
  const high = task({ id: "high", priority: 1 });
  const medium = task({ id: "medium", priority: 5 });
  const result = selectDispatchable([low, high, medium], { maxConcurrentPerRun: 3, currentlyRunning: 0 });
  assert.deepEqual(
    result.map((t) => t.id),
    ["high", "medium", "low"]
  );
});

test("selectDispatchable sorts unprioritized tasks last, behind any with an explicit priority", () => {
  const noPriority = task({ id: "none" });
  const withPriority = task({ id: "prioritized", priority: 100 });
  const result = selectDispatchable([noPriority, withPriority], { maxConcurrentPerRun: 2, currentlyRunning: 0 });
  assert.deepEqual(
    result.map((t) => t.id),
    ["prioritized", "none"]
  );
});

test("selectDispatchable breaks priority ties by original array order", () => {
  const first = task({ id: "first", priority: 5 });
  const second = task({ id: "second", priority: 5 });
  const result = selectDispatchable([first, second], { maxConcurrentPerRun: 2, currentlyRunning: 0 });
  assert.deepEqual(
    result.map((t) => t.id),
    ["first", "second"]
  );
});

test("selectDispatchable caps the result at the remaining capacity", () => {
  const tasks = [task({ id: "a", priority: 1 }), task({ id: "b", priority: 2 }), task({ id: "c", priority: 3 })];
  const result = selectDispatchable(tasks, { maxConcurrentPerRun: 3, currentlyRunning: 1 });
  assert.deepEqual(
    result.map((t) => t.id),
    ["a", "b"]
  );
});

test("selectDispatchable excludes non-runnable tasks (dependencies not satisfied)", () => {
  const blocker = task({ id: "blocker", status: "pending" });
  const dependent = task({ id: "dependent", status: "pending", dependencies: ["blocker"] });
  const result = selectDispatchable([blocker, dependent], { maxConcurrentPerRun: 5, currentlyRunning: 0 });
  assert.deepEqual(
    result.map((t) => t.id),
    ["blocker"]
  );
});

test("selectDispatchable excludes tasks already running or succeeded", () => {
  const running = task({ id: "a", status: "running" });
  const succeeded = task({ id: "b", status: "succeeded" });
  const result = selectDispatchable([running, succeeded], { maxConcurrentPerRun: 5, currentlyRunning: 1 });
  assert.deepEqual(result, []);
});
