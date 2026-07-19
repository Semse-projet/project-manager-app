import test from "node:test";
import assert from "node:assert/strict";

import { createSecurityReviewProvider } from "../../packages/forge/dist/index.js";

const approvedSpec = {
  id: "forge-security-spec",
  path: "docs/specs/forge/security.spec.md",
  digest: "security123",
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
    id: "task-security-1",
    title: "Security review test",
    spec: approvedSpec,
    requestedRole: "security-reviewer",
    riskLevel: "medium",
    objective: "Validate security review provider behavior",
    allowedFiles: ["**"],
    forbiddenFiles: [],
    allowedCommands: [],
    acceptanceCriteria: [],
    dependencies: [],
    targetBranch: "main",
    environment: "local",
    metadata: {},
    ...overrides
  };
}

function review(inputOverrides = {}) {
  const securityReviewProvider = createSecurityReviewProvider({ mode: "dry-run" });
  return securityReviewProvider.review({
    runId: "run-security-1",
    task: task(),
    policy: policy(),
    ...inputOverrides
  });
}

test("dry-run security review provider allows safe task", () => {
  const result = review();
  assert.equal(result.decision, "allow");
  assert.equal(result.findings.length, 0);
  assert.equal(result.violations.length, 0);
});

test("dry-run security review provider denies .env files", () => {
  const result = review({
    task: task({ allowedFiles: [".env", "src/**"] })
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("security.forbidden_file"));
  assert.ok(result.findings.some((f) => f.rule === "security.env_file"));
});

test("dry-run security review provider denies credential files", () => {
  const result = review({
    task: task({ allowedFiles: ["secrets/id_rsa.key", "src/**"] })
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("security.forbidden_file"));
  assert.ok(result.findings.some((f) => f.rule === "security.credential_file"));
});

test("dry-run security review provider flags auth module changes", () => {
  const result = review({
    task: task({ allowedFiles: ["packages/auth/**"] })
  });
  assert.equal(result.decision, "require_approval");
  assert.ok(result.findings.some((f) => f.rule === "security.auth_module" && f.severity === "critical"));
  assert.ok(result.requiredApprovals.includes("dual_control"));
});

test("dry-run security review provider flags database schema changes", () => {
  const result = review({
    task: task({ allowedFiles: ["packages/db/prisma/schema.prisma"] })
  });
  assert.equal(result.decision, "require_approval");
  assert.ok(result.findings.some((f) => f.rule === "security.database_schema"));
});

test("dry-run security review provider flags CI workflow changes", () => {
  const result = review({
    task: task({ allowedFiles: [".github/workflows/ci.yml"] })
  });
  assert.equal(result.decision, "require_approval");
  assert.ok(result.findings.some((f) => f.rule === "security.ci_workflow"));
});

test("dry-run security review provider flags infrastructure changes", () => {
  const result = review({
    task: task({ allowedFiles: ["Dockerfile", "railway.json", "docker-compose.yml"] })
  });
  assert.equal(result.decision, "require_approval");
  assert.ok(result.findings.some((f) => f.rule === "security.infrastructure"));
});

test("dry-run security review provider requires dual control for critical risk", () => {
  const result = review({
    task: task({ riskLevel: "critical", allowedFiles: ["src/**"] })
  });
  assert.equal(result.decision, "require_approval");
  assert.ok(result.requiredApprovals.includes("dual_control"));
});

test("dry-run security review provider uses policy required approvals", () => {
  const result = review({
    policy: policy("require_approval", ["security"]),
    task: task({ allowedFiles: ["src/**"] })
  });
  assert.equal(result.decision, "require_approval");
  assert.ok(result.requiredApprovals.includes("security"));
});

test("dry-run security review provider denies if policy denies", () => {
  const result = review({
    policy: policy("deny", []),
    task: task({ allowedFiles: ["src/**"] })
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("security.policy.denied"));
});

test("live security review provider throws not implemented", () => {
  assert.throws(() => {
    const securityReviewProvider = createSecurityReviewProvider({ mode: "live" });
    securityReviewProvider.review({
      runId: "run-security-live",
      task: task(),
      policy: policy()
    });
  }, /not implemented/);
});
