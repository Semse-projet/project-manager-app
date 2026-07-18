import test from "node:test";
import assert from "node:assert/strict";

import {
  createPatchPlanner
} from "../../packages/forge/dist/index.js";

const approvedSpec = {
  id: "forge-patch-spec",
  path: "docs/specs/forge/patch.spec.md",
  digest: "patch123",
  status: "APPROVED"
};

function task(overrides = {}) {
  return {
    id: "task-patch-1",
    title: "Patch planner test",
    spec: approvedSpec,
    requestedRole: "backend-builder",
    riskLevel: "low",
    objective: "Validate patch planner behavior",
    allowedFiles: ["packages/api/src/**", "docs/**"],
    forbiddenFiles: ["packages/db/**", ".env*"],
    allowedCommands: [],
    acceptanceCriteria: [],
    dependencies: [],
    targetBranch: "agent/forge-patch",
    environment: "sandbox",
    metadata: {},
    ...overrides
  };
}

function plan(proposedFiles, overrides = {}) {
  const patchPlanner = createPatchPlanner({ mode: "dry-run" });
  return patchPlanner.plan(task(overrides), proposedFiles);
}

test("dry-run patch planner allows update inside scope", () => {
  const result = plan([{ path: "packages/api/src/forge/controller.ts", operation: "update", content: "export class Controller {}" }]);
  assert.equal(result.decision, "allow");
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].allowed, true);
  assert.equal(result.violations.length, 0);
});

test("dry-run patch planner allows empty proposed files list", () => {
  const result = plan([]);
  assert.equal(result.decision, "allow");
  assert.equal(result.changes.length, 0);
});

test("dry-run patch planner denies path outside allowed scope", () => {
  const result = plan([{ path: "packages/web/src/app.tsx", operation: "update", content: "" }]);
  assert.equal(result.decision, "deny");
  assert.ok(result.changes[0].violations.some((v) => v === "patch.file_out_of_scope"));
});

test("dry-run patch planner denies forbidden file", () => {
  const result = plan([{ path: "packages/db/prisma/schema.prisma", operation: "update", content: "" }]);
  assert.equal(result.decision, "deny");
  assert.ok(result.changes[0].violations.some((v) => v === "patch.file_forbidden"));
});

test("dry-run patch planner denies files on main branch", () => {
  const result = plan([{ path: "packages/api/src/main.ts", operation: "update", content: "" }], { targetBranch: "main" });
  assert.equal(result.decision, "deny");
  assert.ok(result.changes[0].violations.some((v) => v === "patch.no_direct_default_branch"));
});

test("dry-run patch planner denies parent directory reference", () => {
  const result = plan([{ path: "../package.json", operation: "update", content: "" }]);
  assert.equal(result.decision, "deny");
  assert.ok(result.changes[0].violations.some((v) => v === "patch.parent_directory_reference"));
});

test("dry-run patch planner denies absolute path", () => {
  const result = plan([{ path: "/etc/passwd", operation: "update", content: "" }]);
  assert.equal(result.decision, "deny");
  assert.ok(result.changes[0].violations.some((v) => v === "patch.absolute_or_home_path"));
});

test("dry-run patch planner requires approval for delete", () => {
  const result = plan([{ path: "packages/api/src/forge/controller.ts", operation: "delete" }]);
  assert.equal(result.decision, "require_approval");
  assert.ok(result.changes[0].violations.some((v) => v === "patch.delete_requires_approval"));
});

test("dry-run patch planner requires approval for critical files", () => {
  const result = plan([{ path: "railway.json", operation: "update", content: "{}" }], { allowedFiles: ["packages/api/src/**", "railway.json"] });
  assert.equal(result.decision, "require_approval");
  assert.ok(result.changes[0].violations.some((v) => v === "patch.critical_file"));
});

test("dry-run patch planner denies env files", () => {
  const result = plan([{ path: ".env.local", operation: "update", content: "SECRET=1" }]);
  assert.equal(result.decision, "deny");
  assert.ok(result.changes[0].violations.some((v) => v === "patch.secret_file"));
});

test("live patch planner throws not implemented", () => {
  assert.throws(() => {
    const planner = createPatchPlanner({ mode: "live" });
    planner.plan(task(), [{ path: "x", operation: "update" }]);
  }, /not implemented/i);
});

test("buildForge includes patch plan and overrides policy on forbidden file", async () => {
  const { executeGovernedAgentRun } = await import("../../packages/agents/dist/index.js");
  const result = executeGovernedAgentRun({
    agentType: "forge",
    runId: "run-patch-1",
    correlationId: "corr-patch-1",
    payload: {
      forgeRunId: "forge-run-patch-1",
      taskId: "task-patch-1",
      action: "code.implement",
      task: task({ allowedCommands: ["git status"] }),
      proposedFiles: [{ path: ".env.local", operation: "update", content: "SECRET=1" }],
      operatorContext: {
        source: "forge",
        operatorId: "user-001",
        tenantId: "tenant-001",
        orgId: "org-001",
        roles: ["OPS_ADMIN"],
        scope: "task",
        runId: "forge-run-patch-1",
        taskId: "task-patch-1"
      }
    },
    environment: "sandbox"
  });

  assert.ok(result.payload.patch, "payload should include patch plan");
  assert.equal(result.payload.patch.decision, "deny");
  assert.equal(result.payload.policy.decision, "deny");
  assert.equal(result.requiresHumanReview, true);
});
