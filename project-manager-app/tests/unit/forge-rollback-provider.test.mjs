import test from "node:test";
import assert from "node:assert/strict";

import { createRollbackProvider } from "../../packages/forge/dist/index.js";

const approvedSpec = {
  id: "forge-rollback-spec",
  path: "docs/specs/forge/rollback.spec.md",
  digest: "rollback123",
  status: "APPROVED"
};

function policy(decision = "allow", requiredApprovals = []) {
  return {
    decision,
    reason: "policy evaluated",
    riskLevel: "medium",
    requiredApprovals,
    violatedPolicies: [],
    auditTags: []
  };
}

function task(overrides = {}) {
  return {
    id: "task-rollback-1",
    title: "Rollback test",
    spec: approvedSpec,
    requestedRole: "devops-release",
    riskLevel: "medium",
    objective: "Validate rollback provider behavior",
    allowedFiles: [".github/**", "infra/**"],
    forbiddenFiles: [".env*"],
    allowedCommands: [],
    acceptanceCriteria: [],
    dependencies: [],
    targetBranch: "main",
    environment: "staging",
    metadata: {},
    ...overrides
  };
}

function plan(inputOverrides = {}) {
  const rollbackProvider = createRollbackProvider({ mode: "dry-run" });
  return rollbackProvider.plan({
    runId: "run-rollback-1",
    task: task(),
    policy: policy(),
    ...inputOverrides
  });
}

test("dry-run rollback provider allows staging rollback", () => {
  const result = plan();
  assert.equal(result.decision, "allow");
  assert.equal(result.environment, "staging");
  assert.ok(result.steps.includes("restore_release"));
  assert.ok(result.steps.includes("verify_health"));
  assert.ok(result.steps.includes("observe"));
  assert.equal(result.violations.length, 0);
});

test("dry-run rollback provider requires approval for production", () => {
  const result = plan({
    task: task({ environment: "production", riskLevel: "high" })
  });
  assert.equal(result.decision, "require_approval");
  assert.ok(result.requiredApprovals.includes("dual_control"));
  assert.ok(result.violations.includes("rollback.production_requires_approval"));
});

test("dry-run rollback provider denies unknown environment", () => {
  const result = plan({
    task: task({ environment: "cloud-99" })
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("rollback.invalid_environment"));
});

test("dry-run rollback provider denies production to non-default branch", () => {
  const result = plan({
    task: task({ environment: "production", targetBranch: "feature/x" })
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("rollback.production_requires_default_branch"));
});

test("dry-run rollback provider requires security approval for data files", () => {
  const result = plan({
    task: task({
      allowedFiles: ["packages/db/prisma/migrations/**", "**/*.sql"]
    })
  });
  assert.equal(result.decision, "require_approval");
  assert.ok(result.requiredApprovals.includes("security"));
  assert.ok(result.steps.includes("data_backup"));
  assert.ok(result.violations.includes("rollback.data_files_require_approval"));
});

test("dry-run rollback provider denies if policy denies", () => {
  const result = plan({
    policy: policy("deny")
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("rollback.policy.denied"));
});

test("dry-run rollback provider denies if deployment plan denied", () => {
  const deploymentPlan = {
    mode: "dry-run",
    decision: "deny",
    reason: "blocked",
    environment: "staging",
    targetBranch: "main",
    steps: [],
    requiredApprovals: [],
    violations: ["deployment.blocked"],
    auditTags: []
  };
  const result = plan({ deploymentPlan });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("rollback.deployment_plan.denied"));
});

test("live rollback provider throws not implemented", () => {
  assert.throws(() => {
    const rollbackProvider = createRollbackProvider({ mode: "live" });
    rollbackProvider.plan({
      runId: "run-rollback-live",
      task: task(),
      policy: policy()
    });
  }, /not implemented/i);
});
