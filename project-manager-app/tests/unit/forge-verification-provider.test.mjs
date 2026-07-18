import test from "node:test";
import assert from "node:assert/strict";

import {
  createVerificationProvider
} from "../../packages/forge/dist/index.js";

function patchResult(decision = "allow") {
  return {
    mode: "dry-run",
    decision,
    reason: "test",
    results: [],
    violations: [],
    auditTags: []
  };
}

function toolPlan(allowedTools = ["command.run", "code.write", "test.write"]) {
  return {
    mode: "dry-run",
    decision: "allow",
    reason: "test",
    action: "code.implement",
    riskLevel: "low",
    tools: allowedTools.map((name) => ({ name, allowed: true, violations: [] })),
    requiredApprovals: [],
    violations: [],
    auditTags: []
  };
}

function task(acceptanceCriteria = []) {
  return {
    id: "task-verification-1",
    title: "Verification test",
    spec: { id: "spec-1", path: "docs/specs/forge/test.md", digest: "abc", status: "APPROVED" },
    requestedRole: "backend-builder",
    riskLevel: "low",
    objective: "Verify dry-run matrix",
    allowedFiles: ["packages/api/src/**"],
    forbiddenFiles: [".env*"],
    allowedCommands: [],
    acceptanceCriteria,
    dependencies: [],
    targetBranch: "agent/forge-verification-provider",
    environment: "sandbox",
    metadata: {}
  };
}

test("dry-run verification passes spec/index criteria when patch is allowed", () => {
  const provider = createVerificationProvider({ mode: "dry-run" });
  const matrix = provider.verify({
    task: task([{ id: "ac-1", statement: "Spec must be indexed", verification: "pnpm spec:index", required: true }]),
    patchResult: patchResult(),
    toolPlan: toolPlan()
  });

  assert.equal(matrix.passed, true);
  assert.equal(matrix.items[0].status, "passed");
});

test("dry-run verification fails security criterion without evidence", () => {
  const provider = createVerificationProvider({ mode: "dry-run" });
  const matrix = provider.verify({
    task: task([{ id: "ac-sec", statement: "Security review must pass", verification: "security review", required: true }]),
    patchResult: patchResult(),
    toolPlan: toolPlan()
  });

  assert.equal(matrix.passed, false);
  assert.equal(matrix.items[0].status, "failed");
});

test("dry-run verification skips optional unrecognized criteria", () => {
  const provider = createVerificationProvider({ mode: "dry-run" });
  const matrix = provider.verify({
    task: task([{ id: "ac-opt", statement: "Check external API", verification: "curl", required: false }]),
    patchResult: patchResult(),
    toolPlan: toolPlan()
  });

  assert.equal(matrix.passed, true);
  assert.equal(matrix.items[0].status, "skipped");
});

test("dry-run verification fails required unrecognized criteria", () => {
  const provider = createVerificationProvider({ mode: "dry-run" });
  const matrix = provider.verify({
    task: task([{ id: "ac-req", statement: "Check external API", verification: "curl", required: true }]),
    patchResult: patchResult(),
    toolPlan: toolPlan()
  });

  assert.equal(matrix.passed, false);
  assert.equal(matrix.items[0].status, "failed");
});

test("dry-run verification marks tests passed when test.write tool is allowed", () => {
  const provider = createVerificationProvider({ mode: "dry-run" });
  const matrix = provider.verify({
    task: task([{ id: "ac-test", statement: "Unit tests must pass", verification: "pnpm test:unit", required: true }]),
    patchResult: patchResult(),
    toolPlan: toolPlan()
  });

  assert.equal(matrix.passed, true);
  assert.equal(matrix.items[0].status, "passed");
});

test("live verification provider throws not implemented", () => {
  assert.throws(() => {
    const provider = createVerificationProvider({ mode: "live" });
    provider.verify({ task: task() });
  }, /not implemented/i);
});
