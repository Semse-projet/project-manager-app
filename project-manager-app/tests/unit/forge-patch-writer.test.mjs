import test from "node:test";
import assert from "node:assert/strict";

import {
  createPatchPlanner,
  createPatchWriter
} from "../../packages/forge/dist/index.js";

const approvedSpec = {
  id: "forge-patch-writer-spec",
  path: "docs/specs/forge/patch-writer.spec.md",
  digest: "patchwriter123",
  status: "APPROVED"
};

function task(overrides = {}) {
  return {
    id: "task-patch-writer-1",
    title: "Patch writer test",
    spec: approvedSpec,
    requestedRole: "backend-builder",
    riskLevel: "low",
    objective: "Test patch writer simulation",
    allowedFiles: ["packages/api/src/**"],
    forbiddenFiles: [".env*"],
    allowedCommands: [],
    acceptanceCriteria: [],
    dependencies: [],
    targetBranch: "agent/forge-patch-writer",
    environment: "sandbox",
    metadata: {},
    ...overrides
  };
}

function plan(taskPacket, proposedFiles) {
  const planner = createPatchPlanner({ mode: "dry-run" });
  return planner.plan(taskPacket, proposedFiles);
}

test("dry-run patch writer simulates a create with content", () => {
  const patchPlan = plan(task(), [
    { path: "packages/api/src/forge/controller.ts", operation: "create", content: "export class Controller {}" }
  ]);
  const writer = createPatchWriter({ mode: "dry-run" });
  const result = writer.apply(patchPlan);

  assert.equal(result.decision, "allow");
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].operation, "create");
  assert.equal(result.results[0].newContent, "export class Controller {}");
  assert.equal(result.results[0].applied, true);
});

test("dry-run patch writer simulates an update with content", () => {
  const patchPlan = plan(task(), [
    { path: "packages/api/src/forge/service.ts", operation: "update", content: "export class Service {}" }
  ]);
  const writer = createPatchWriter({ mode: "dry-run" });
  const result = writer.apply(patchPlan);

  assert.equal(result.decision, "allow");
  assert.equal(result.results[0].newContent, "export class Service {}");
  assert.equal(result.results[0].previousContent, "<dry-run-baseline>");
});

test("dry-run patch writer simulates a delete", () => {
  const patchPlan = plan(task(), [
    { path: "packages/api/src/forge/legacy.ts", operation: "delete" }
  ]);
  const writer = createPatchWriter({ mode: "dry-run" });
  const result = writer.apply(patchPlan);

  assert.equal(result.decision, "allow");
  assert.equal(result.results[0].operation, "delete");
  assert.equal(result.results[0].newContent, undefined);
  assert.equal(result.results[0].applied, true);
});

test("dry-run patch writer denies a denied patch plan", () => {
  const patchPlan = plan(task({ targetBranch: "main" }), [
    { path: "packages/api/src/forge/controller.ts", operation: "create", content: "export class Controller {}" }
  ]);
  const writer = createPatchWriter({ mode: "dry-run" });
  const result = writer.apply(patchPlan);

  assert.equal(result.decision, "deny");
  assert.equal(result.violations[0], "patch.plan_denied");
  assert.equal(result.results.length, 0);
});

test("dry-run patch writer denies duplicate paths", () => {
  const patchPlan = plan(task(), [
    { path: "packages/api/src/forge/controller.ts", operation: "create", content: "first" },
    { path: "packages/api/src/forge/controller.ts", operation: "update", content: "second" }
  ]);
  const writer = createPatchWriter({ mode: "dry-run" });
  const result = writer.apply(patchPlan);

  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("patch.duplicate_path"));
});

test("dry-run patch writer denies create/update missing content and diff", () => {
  const patchPlan = plan(task(), [
    { path: "packages/api/src/forge/missing.ts", operation: "create" }
  ]);
  // Planner should deny before writer due to missing content; writer just returns deny.
  const writer = createPatchWriter({ mode: "dry-run" });
  const result = writer.apply(patchPlan);

  assert.equal(result.decision, "deny");
});

test("dry-run patch writer allows empty patch plan", () => {
  const patchPlan = plan(task(), []);
  const writer = createPatchWriter({ mode: "dry-run" });
  const result = writer.apply(patchPlan);

  assert.equal(result.decision, "allow");
  assert.equal(result.results.length, 0);
});

test("live patch writer throws not implemented", () => {
  assert.throws(() => {
    const writer = createPatchWriter({ mode: "live" });
    writer.apply(plan(task(), []));
  }, /not implemented/i);
});
