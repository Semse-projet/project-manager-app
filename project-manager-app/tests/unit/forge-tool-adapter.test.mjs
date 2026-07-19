import test from "node:test";
import assert from "node:assert/strict";

import {
  createToolAdapter
} from "../../packages/forge/dist/index.js";

const approvedSpec = {
  id: "forge-tool-adapter-spec",
  path: "docs/specs/forge/tool-adapter.spec.md",
  digest: "tool123",
  status: "APPROVED"
};

function task(role, overrides = {}) {
  const allowedFiles = role === "data-engineer"
    ? ["packages/db/**", "packages/schemas/**", "docs/specs/**"]
    : ["packages/api/src/**", "docs/**"];
  const forbiddenFiles = role === "data-engineer"
    ? [".env*"]
    : ["packages/db/**", ".env*"];

  return {
    id: "task-tool-1",
    title: "Tool adapter test",
    spec: approvedSpec,
    requestedRole: role,
    riskLevel: "low",
    objective: "Validate tool adapter behavior",
    allowedFiles,
    forbiddenFiles,
    allowedCommands: [],
    acceptanceCriteria: [],
    dependencies: [],
    targetBranch: "agent/forge-tool-adapter",
    environment: "sandbox",
    metadata: {},
    ...overrides
  };
}

function plan(role, action, overrides = {}) {
  const adapter = createToolAdapter({ mode: "dry-run" });
  return adapter.plan({ task: task(role, overrides), action });
}

test("dry-run tool adapter allows code.implement for backend-builder", () => {
  const result = plan("backend-builder", "code.implement");
  assert.equal(result.decision, "allow");
  assert.ok(result.tools.some((t) => t.name === "code.write" && t.allowed));
  assert.ok(result.tools.some((t) => t.name === "command.run" && t.allowed));
});

test("dry-run tool adapter allows runtime.execute with empty tool list", () => {
  const result = plan("backend-builder", "runtime.execute");
  assert.equal(result.decision, "allow");
  assert.equal(result.tools.length, 0);
});

test("dry-run tool adapter requires approval for deployment.propose", () => {
  const result = plan("devops-release", "deployment.propose");
  assert.equal(result.decision, "require_approval");
  assert.ok(result.tools.every((t) => t.allowed));
});

test("dry-run tool adapter denies unknown action", () => {
  const result = plan("backend-builder", "unknown.action");
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("tool.action.unknown"));
});

test("dry-run tool adapter denies when role lacks required tool", () => {
  const result = plan("documentation-curator", "code.implement");
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.some((v) => v.includes("not_allowed")));
});

test("dry-run tool adapter requires approval for migration.propose", () => {
  const result = plan("data-engineer", "migration.propose");
  assert.equal(result.decision, "require_approval");
});

test("dry-run tool adapter includes audit.record for all actions", () => {
  const result = plan("backend-builder", "code.implement");
  assert.ok(result.tools.some((t) => t.name === "audit.record" && t.allowed));
});

test("dry-run tool adapter allows pr.prepare for forge-supervisor", () => {
  const result = plan("forge-supervisor", "pr.prepare");
  assert.equal(result.decision, "allow");
  assert.ok(result.tools.every((t) => t.allowed));
});

test("dry-run tool adapter allows schema.propose for domain-architect", () => {
  const result = plan("domain-architect", "schema.propose");
  assert.equal(result.decision, "require_approval");
  assert.ok(result.tools.every((t) => t.allowed));
});

test("dry-run tool adapter allows blueprint.create for creator-mentor", () => {
  const result = plan("creator-mentor", "blueprint.create");
  assert.equal(result.decision, "allow");
  assert.ok(result.tools.every((t) => t.allowed));
});

test("dry-run tool adapter allows publication.propose for creator-mentor", () => {
  const result = plan("creator-mentor", "publication.propose");
  assert.equal(result.decision, "require_approval");
  assert.ok(result.tools.every((t) => t.allowed));
});

test("dry-run tool adapter allows ui.compose for ux-composer", () => {
  const result = plan("ux-composer", "ui.compose");
  assert.equal(result.decision, "allow");
  assert.ok(result.tools.every((t) => t.allowed));
});

test("dry-run tool adapter allows rollback.plan for data-engineer", () => {
  const result = plan("data-engineer", "rollback.plan");
  assert.equal(result.decision, "require_approval");
  assert.ok(result.tools.every((t) => t.allowed));
});

test("live tool adapter throws not implemented", () => {
  assert.throws(() => {
    const adapter = createToolAdapter({ mode: "live" });
    adapter.plan({ task: task("backend-builder"), action: "code.implement" });
  }, /not implemented/i);
});

test("buildForge includes tool plan and requires approval for critical action", async () => {
  const { executeGovernedAgentRun } = await import("../../packages/agents/dist/index.js");
  const result = executeGovernedAgentRun({
    agentType: "forge",
    runId: "run-tool-1",
    correlationId: "corr-tool-1",
    payload: {
      forgeRunId: "forge-run-tool-1",
      taskId: "task-tool-1",
      action: "deployment.propose",
      task: task("devops-release", {
        allowedFiles: [".github/**", "railway.json", "scripts/**"],
        allowedCommands: ["git status"]
      }),
      operatorContext: {
        source: "forge",
        operatorId: "user-001",
        tenantId: "tenant-001",
        orgId: "org-001",
        roles: ["OPS_ADMIN"],
        scope: "task",
        runId: "forge-run-tool-1",
        taskId: "task-tool-1"
      }
    },
    environment: "sandbox"
  });

  assert.ok(result.payload.tools, "payload should include tool plan");
  assert.equal(result.payload.tools.decision, "require_approval");
  assert.equal(result.payload.policy.decision, "require_approval");
  assert.equal(result.requiresHumanReview, true);
});
