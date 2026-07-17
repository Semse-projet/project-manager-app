import test from "node:test";
import assert from "node:assert/strict";

import {
  executeSpecializedAgent,
  getRuntimeAgentManifest,
  runtimeAgentRoles
} from "../../packages/agents/dist/index.js";

const approvedSpec = {
  id: "forge-runtime-spec",
  path: "docs/specs/forge/runtime.spec.md",
  digest: "def456",
  status: "APPROVED"
};

function forgeTask(overrides = {}) {
  return {
    id: "task-runtime-1",
    title: "Update Forge runtime docs",
    spec: approvedSpec,
    requestedRole: "documentation-curator",
    riskLevel: "low",
    objective: "Update runtime integration docs",
    allowedFiles: ["docs/specs/forge/**", "packages/forge/src/**"],
    forbiddenFiles: ["packages/db/**", ".env*"],
    allowedCommands: ["docs.update"],
    acceptanceCriteria: [],
    dependencies: [],
    targetBranch: "agent/forge-runtime-docs",
    environment: "sandbox",
    metadata: {},
    ...overrides
  };
}

test("runtime agent roles include forge", () => {
  assert.ok(runtimeAgentRoles.includes("forge"));
});

test("forge manifest exposes expected capabilities", () => {
  const manifest = getRuntimeAgentManifest("forge");
  assert.equal(manifest.role, "forge");
  assert.ok(manifest.capabilities.allowedActions.includes("runtime.execute"));
  assert.equal(manifest.capabilities.maxRiskLevel, "critical");
});

test("forge specialized handler evaluates a low-risk task as allow", () => {
  const result = executeSpecializedAgent("forge", {
    forgeRunId: "run-runtime-1",
    taskId: "task-runtime-1",
    task: forgeTask(),
    operatorContext: {
      source: "forge",
      operatorId: "user-001",
      tenantId: "tenant-001",
      orgId: "org-001",
      roles: ["OPS_ADMIN"],
      scope: "task",
      runId: "run-runtime-1",
      taskId: "task-runtime-1"
    },
    environment: "sandbox"
  });

  assert.equal(result.actionType, "forge.evaluate");
  assert.equal(result.requiresHumanReview, false);
  assert.equal(result.payload.policy.decision, "allow");
  assert.equal(result.payload.requestedRole, "documentation-curator");
});

test("forge specialized handler denies tasks targeting main branch", () => {
  const result = executeSpecializedAgent("forge", {
    forgeRunId: "run-runtime-2",
    taskId: "task-runtime-2",
    task: forgeTask({ targetBranch: "main" }),
    operatorContext: {
      source: "forge",
      operatorId: "user-001",
      tenantId: "tenant-001",
      orgId: "org-001",
      roles: ["OPS_ADMIN"],
      scope: "task",
      runId: "run-runtime-2",
      taskId: "task-runtime-2"
    },
    environment: "sandbox"
  });

  assert.equal(result.actionType, "forge.evaluate");
  assert.equal(result.requiresHumanReview, true);
  assert.equal(result.payload.policy.decision, "deny");
});
