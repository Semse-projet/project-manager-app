import test from "node:test";
import assert from "node:assert/strict";

import { createSandboxProvider } from "../../packages/forge/dist/index.js";

const approvedSpec = {
  id: "forge-sandbox-spec",
  path: "docs/specs/forge/sandbox.spec.md",
  digest: "sandbox123",
  status: "APPROVED"
};

function task(overrides = {}) {
  return {
    id: "task-sandbox-1",
    title: "Sandbox validation test",
    spec: approvedSpec,
    requestedRole: "documentation-curator",
    riskLevel: "low",
    objective: "Validate sandbox behavior",
    allowedFiles: ["docs/**", "packages/forge/src/**"],
    forbiddenFiles: ["packages/db/**", ".env*"],
    allowedCommands: [],
    acceptanceCriteria: [],
    dependencies: [],
    targetBranch: "agent/forge-sandbox",
    environment: "sandbox",
    metadata: {},
    ...overrides
  };
}

function plan(overrides = {}) {
  const sandboxProvider = createSandboxProvider({ mode: "dry-run" });
  return sandboxProvider.plan({ task: task(overrides) });
}

test("dry-run sandbox allows safe read-only command", () => {
  const result = plan({ allowedCommands: ["git status"] });
  assert.equal(result.decision, "allow");
  assert.equal(result.commands.length, 1);
  assert.equal(result.commands[0].program, "git");
  assert.equal(result.commands[0].allowed, true);
  assert.equal(result.violations.length, 0);
});

test("dry-run sandbox denies shell metacharacters", () => {
  const result = plan({ allowedCommands: ["git status; rm -rf /"] });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.some((v) => v === "sandbox.forbidden_shell_characters"));
});

test("dry-run sandbox denies absolute path", () => {
  const result = plan({ allowedCommands: ["cat /etc/passwd"] });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.some((v) => v.startsWith("sandbox.absolute_or_home_path")));
});

test("dry-run sandbox denies parent directory reference", () => {
  const result = plan({ allowedCommands: ["cat ../package.json"] });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.some((v) => v.startsWith("sandbox.parent_directory_reference")));
});

test("dry-run sandbox denies file out of allowed scope", () => {
  const result = plan({ allowedCommands: ["cat packages/db/prisma/schema.prisma"] });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.some((v) => v.startsWith("sandbox.file_out_of_scope")));
});

test("dry-run sandbox denies forbidden file", () => {
  const result = plan({ allowedCommands: ["cat .env.local"] });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.some((v) => v.startsWith("sandbox.file_forbidden")));
});

test("dry-run sandbox requires approval for dangerous programs", () => {
  const result = plan({ allowedCommands: ["rm packages/forge/src/old.ts"], allowedFiles: ["packages/forge/src/**", "docs/**"] });
  assert.equal(result.decision, "require_approval");
  assert.ok(result.violations.some((v) => v.startsWith("sandbox.dangerous_program")));
  assert.ok(result.requiredApprovals.includes("ops_admin"));
});

test("dry-run sandbox denies dangerous programs in production", () => {
  const result = plan({ allowedCommands: ["rm packages/forge/src/old.ts"], allowedFiles: ["packages/forge/src/**", "docs/**"], environment: "production" });
  assert.equal(result.decision, "deny");
});

test("dry-run sandbox ignores scoped package names as paths", () => {
  const result = plan({ allowedCommands: ["pnpm --filter @semse/web build"] });
  assert.equal(result.decision, "allow");
});

test("dry-run sandbox validates file extension tokens", () => {
  const result = plan({ allowedCommands: ["cat package.json"] });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.some((v) => v.startsWith("sandbox.file_out_of_scope")));
});

test("dry-run sandbox allows file extension tokens inside scope", () => {
  const result = plan({ allowedCommands: ["cat docs/specs/forge/sandbox.spec.md"], allowedFiles: ["docs/**"] });
  assert.equal(result.decision, "allow");
});

test("dry-run sandbox denies parent directory reference even when path matches allowed scope", () => {
  const result = plan({
    allowedCommands: ["cat packages/../secret.json"],
    allowedFiles: ["packages/**"]
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.some((v) => v.startsWith("sandbox.parent_directory_reference")));
});

test("dry-run sandbox denies absolute path even when all files are allowed", () => {
  const result = plan({ allowedCommands: ["cat /etc/passwd"], allowedFiles: ["**"] });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.some((v) => v.startsWith("sandbox.absolute_or_home_path")));
});

test("dry-run sandbox denies home path even when all files are allowed", () => {
  const result = plan({ allowedCommands: ["cat ~/.ssh/id_rsa"], allowedFiles: ["**"] });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.some((v) => v.startsWith("sandbox.absolute_or_home_path")));
});

test("dry-run sandbox returns allow for empty command list", () => {
  const result = plan();
  assert.equal(result.decision, "allow");
  assert.equal(result.commands.length, 0);
});

test("live sandbox provider throws not implemented", () => {
  assert.throws(() => {
    const provider = createSandboxProvider({ mode: "live" });
    provider.plan({ task: task({ allowedCommands: ["git status"] }) });
  }, /not implemented/i);
});

test("buildForge includes sandbox plan and overrides policy on deny", async () => {
  const { executeGovernedAgentRun } = await import("../../packages/agents/dist/index.js");
  const result = executeGovernedAgentRun({
    agentType: "forge",
    runId: "run-sandbox-1",
    correlationId: "corr-sandbox-1",
    payload: {
      forgeRunId: "forge-run-sandbox-1",
      taskId: "task-sandbox-1",
      task: task({ allowedCommands: ["cat .env.local"] }),
      operatorContext: {
        source: "forge",
        operatorId: "user-001",
        tenantId: "tenant-001",
        orgId: "org-001",
        roles: ["OPS_ADMIN"],
        scope: "task",
        runId: "forge-run-sandbox-1",
        taskId: "task-sandbox-1"
      }
    },
    environment: "sandbox"
  });

  assert.ok(result.payload.sandbox, "payload should include sandbox plan");
  assert.equal(result.payload.sandbox.decision, "deny");
  assert.equal(result.payload.policy.decision, "deny");
  assert.equal(result.requiresHumanReview, true);
});
