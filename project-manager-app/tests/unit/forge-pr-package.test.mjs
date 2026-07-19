import test from "node:test";
import assert from "node:assert/strict";

import {
  createPRPackageProvider
} from "../../packages/forge/dist/index.js";

function policy(decision = "allow", requiredApprovals = []) {
  return {
    decision,
    reason: "test",
    riskLevel: "low",
    requiredApprovals,
    violatedPolicies: [],
    auditTags: ["forge.policy.allowed"]
  };
}

function patchResult(decision = "allow", results = []) {
  return {
    mode: "dry-run",
    decision,
    reason: "test",
    results,
    violations: [],
    auditTags: []
  };
}

function verification(passed = true) {
  return {
    runId: "task-pr-1",
    items: [{ id: "ac-1", command: "pnpm spec:index", required: true, status: "passed" }],
    passed,
    completedAt: new Date().toISOString()
  };
}

function task(overrides = {}) {
  return {
    id: "task-pr-1",
    title: "Add PR package provider",
    spec: { id: "spec-pr-1", path: "docs/specs/forge/pr-package.md", digest: "abc", status: "APPROVED" },
    requestedRole: "backend-builder",
    riskLevel: "low",
    objective: "Assemble PR package",
    allowedFiles: ["packages/forge/src/**"],
    forbiddenFiles: [".env*", "packages/db/**"],
    allowedCommands: [],
    acceptanceCriteria: [{ id: "ac-1", statement: "Spec indexed", verification: "pnpm spec:index", required: true }],
    dependencies: [],
    targetBranch: "agent/forge-pr-package",
    environment: "sandbox",
    metadata: {},
    ...overrides
  };
}

test("dry-run PR package assembles allow with complete input", () => {
  const provider = createPRPackageProvider({ mode: "dry-run" });
  const result = provider.assemble({
    runId: "run-pr-1",
    task: task(),
    policy: policy(),
    patchResult: patchResult("allow", [
      { path: "packages/forge/src/pr-package.ts", operation: "create", applied: true, newContent: "export {}", violations: [] }
    ]),
    verification: verification(true)
  });

  assert.equal(result.decision, "allow");
  assert.equal(result.headBranch, "agent/forge-pr-package");
  assert.equal(result.baseBranch, "main");
  assert.equal(result.draft, false);
  assert.equal(result.changedFiles.length, 1);
  assert.ok(result.body.includes("Spec reference"));
  assert.ok(result.checklist.length > 0);
});

test("dry-run PR package denies if targetBranch is main", () => {
  const provider = createPRPackageProvider({ mode: "dry-run" });
  const result = provider.assemble({
    runId: "run-pr-1",
    task: task({ targetBranch: "main" }),
    policy: policy(),
    patchResult: patchResult(),
    verification: verification(true)
  });

  assert.equal(result.decision, "deny");
  assert.ok(result.violations.some((v) => v.includes("target_branch")));
});

test("dry-run PR package denies if policy is deny", () => {
  const provider = createPRPackageProvider({ mode: "dry-run" });
  const result = provider.assemble({
    runId: "run-pr-1",
    task: task(),
    policy: policy("deny"),
    patchResult: patchResult(),
    verification: verification(true)
  });

  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("pr.policy.denied"));
});

test("dry-run PR package denies if patchResult is deny", () => {
  const provider = createPRPackageProvider({ mode: "dry-run" });
  const result = provider.assemble({
    runId: "run-pr-1",
    task: task(),
    policy: policy(),
    patchResult: patchResult("deny"),
    verification: verification(true)
  });

  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("pr.patch.denied"));
});

test("dry-run PR package denies if verification failed", () => {
  const provider = createPRPackageProvider({ mode: "dry-run" });
  const result = provider.assemble({
    runId: "run-pr-1",
    task: task(),
    policy: policy(),
    patchResult: patchResult(),
    verification: verification(false)
  });

  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("pr.verification.failed"));
});

test("dry-run PR package marks require_approval when policy requires approval", () => {
  const provider = createPRPackageProvider({ mode: "dry-run" });
  const result = provider.assemble({
    runId: "run-pr-1",
    task: task(),
    policy: policy("require_approval", ["ops_admin"]),
    patchResult: patchResult(),
    verification: verification(true)
  });

  assert.equal(result.decision, "require_approval");
  assert.equal(result.draft, false);
  assert.deepEqual(result.requiredApprovals, ["ops_admin"]);
  assert.ok(result.body.includes("Approvals"));
});

test("dry-run PR package marks draft for high risk", () => {
  const provider = createPRPackageProvider({ mode: "dry-run" });
  const result = provider.assemble({
    runId: "run-pr-1",
    task: task({ riskLevel: "high" }),
    policy: policy(),
    patchResult: patchResult(),
    verification: verification(true)
  });

  assert.equal(result.draft, true);
  assert.ok(result.reviewers.includes("ops_admin"));
});

test("dry-run PR package allows empty patch", () => {
  const provider = createPRPackageProvider({ mode: "dry-run" });
  const result = provider.assemble({
    runId: "run-pr-1",
    task: task(),
    policy: policy(),
    patchResult: patchResult("allow", []),
    verification: verification(true)
  });

  assert.equal(result.decision, "allow");
  assert.equal(result.changedFiles.length, 0);
});

test("dry-run PR package denies forbidden file", () => {
  const provider = createPRPackageProvider({ mode: "dry-run" });
  const result = provider.assemble({
    runId: "run-pr-1",
    task: task(),
    policy: policy(),
    patchResult: patchResult("allow", [
      { path: "packages/db/schema.prisma", operation: "update", applied: true, newContent: "", violations: [] }
    ]),
    verification: verification(true)
  });

  assert.equal(result.decision, "deny");
  assert.ok(result.violations.some((v) => v.includes("forbidden")));
});

test("live PR package provider throws not implemented", () => {
  assert.throws(() => {
    const provider = createPRPackageProvider({ mode: "live" });
    provider.assemble({
      runId: "run-pr-1",
      task: task(),
      policy: policy(),
      patchResult: patchResult(),
      verification: verification(true)
    });
  }, /not implemented/i);
});
