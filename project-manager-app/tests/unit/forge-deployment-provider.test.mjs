import test from "node:test";
import assert from "node:assert/strict";

import { createDeploymentProvider } from "../../packages/forge/dist/index.js";

const approvedSpec = {
  id: "forge-deployment-spec",
  path: "docs/specs/forge/deployment.spec.md",
  digest: "deploy123",
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
    id: "task-deploy-1",
    title: "Deployment test",
    spec: approvedSpec,
    requestedRole: "devops-release",
    riskLevel: "medium",
    objective: "Validate deployment provider behavior",
    allowedFiles: ["infra/**", ".github/**"],
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
  const deploymentProvider = createDeploymentProvider({ mode: "dry-run" });
  return deploymentProvider.plan({
    runId: "run-deploy-1",
    task: task(),
    policy: policy(),
    ...inputOverrides
  });
}

test("dry-run deployment provider allows staging deployment", () => {
  const result = plan();
  assert.equal(result.decision, "allow");
  assert.equal(result.environment, "staging");
  assert.ok(result.steps.includes("deploy:staging"));
  assert.equal(result.violations.length, 0);
});

test("dry-run deployment provider requires approval for production", () => {
  const result = plan({
    task: task({ environment: "production", riskLevel: "high" })
  });
  assert.equal(result.decision, "require_approval");
  assert.ok(result.requiredApprovals.includes("dual_control"));
  assert.ok(result.violations.includes("deployment.production_requires_approval"));
});

test("dry-run deployment provider denies unknown environment", () => {
  const result = plan({
    task: task({ environment: "cloud-99" })
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("deployment.invalid_environment"));
});

test("dry-run deployment provider denies production to non-default branch", () => {
  const result = plan({
    task: task({ environment: "production", targetBranch: "feature/x" })
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("deployment.production_requires_default_branch"));
});

test("dry-run deployment provider requires security approval for critical files", () => {
  const result = plan({
    prPackage: {
      mode: "dry-run",
      decision: "allow",
      reason: "pr ok",
      title: "PR",
      body: "body",
      baseBranch: "main",
      headBranch: "agent/x",
      commits: [],
      changedFiles: ["infra/railway/railway.json", "apps/api/src/modules/forge/controller.ts"],
      reviewers: [],
      labels: [],
      draft: false,
      checklist: [],
      requiredApprovals: [],
      violations: [],
      auditTags: []
    }
  });
  assert.equal(result.decision, "require_approval");
  assert.ok(result.requiredApprovals.includes("security"));
  assert.ok(result.violations.includes("deployment.critical_infrastructure_requires_approval"));
});

test("dry-run deployment provider denies if policy denies", () => {
  const result = plan({
    policy: policy("deny")
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("deployment.policy.denied"));
});

test("dry-run deployment provider denies if pr package denies", () => {
  const result = plan({
    prPackage: {
      mode: "dry-run",
      decision: "deny",
      reason: "blocked",
      title: "PR",
      body: "body",
      baseBranch: "main",
      headBranch: "agent/x",
      commits: [],
      changedFiles: [],
      reviewers: [],
      labels: [],
      draft: false,
      checklist: [],
      requiredApprovals: [],
      violations: ["pr.blocked"],
      auditTags: []
    }
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("deployment.pr_package.denied"));
});

test("live deployment provider throws not implemented", () => {
  assert.throws(() => {
    const deploymentProvider = createDeploymentProvider({ mode: "live" });
    deploymentProvider.plan({
      runId: "run-deploy-live",
      task: task(),
      policy: policy()
    });
  }, /not implemented/i);
});
