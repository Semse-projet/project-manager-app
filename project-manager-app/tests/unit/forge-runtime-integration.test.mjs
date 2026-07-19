import test from "node:test";
import assert from "node:assert/strict";

import {
  executeSpecializedAgent,
  getRuntimeAgentManifest,
  runtimeAgentRoles
} from "../../packages/agents/dist/index.js";
import {
  executeSpecializedWorkerRun,
  shouldUseSpecializedWorkerHandler
} from "../../apps/worker/src/agent-run-handlers.mjs";

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
    allowedCommands: ["git status"],
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
  assert.equal(result.payload.sandbox?.decision, "allow");
  assert.equal(result.payload.sandbox?.commands[0]?.program, "git");
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

test("forge is registered as a specialized worker handler", () => {
  assert.ok(shouldUseSpecializedWorkerHandler("forge"));
});

test("worker handleForge evaluates a low-risk task and calls completion callback", async () => {
  const calls = [];
  const requestJson = async (path, init) => {
    calls.push({ path, body: JSON.parse(init.body) });
    return { ok: true };
  };

  const result = await executeSpecializedWorkerRun({
    run: {
      id: "agent-run-1",
      correlationId: "corr-1",
      agentType: "forge",
      input: {
        forgeRunId: "forge-run-1",
        taskId: "task-runtime-1",
        task: forgeTask(),
        operatorContext: {
          source: "forge",
          operatorId: "user-001",
          tenantId: "tenant-001",
          orgId: "org-001",
          roles: ["OPS_ADMIN"],
          scope: "task",
          runId: "forge-run-1",
          taskId: "task-runtime-1"
        }
      }
    },
    requestJson,
    logger: { warn: () => {} },
    tenantId: "tenant-001"
  });

  assert.equal(result.actionType, "forge.evaluate");
  assert.equal(result.requiresHumanReview, false);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].path.includes("/v1/forge/runs/forge-run-1/tasks/task-runtime-1/complete"));
  assert.equal(calls[0].body.agentRunId, "agent-run-1");
  assert.equal(calls[0].body.result.payload.policy.decision, "allow");
  assert.equal(calls[0].body.result.payload.sandbox?.decision, "allow");
  assert.equal(calls[0].body.result.payload.sandbox?.commands[0]?.program, "git");
});

test("worker handleForge reports policy deny for tasks targeting main", async () => {
  const calls = [];
  const requestJson = async (path, init) => {
    calls.push({ path, body: JSON.parse(init.body) });
    return { ok: true };
  };

  const result = await executeSpecializedWorkerRun({
    run: {
      id: "agent-run-2",
      correlationId: "corr-2",
      agentType: "forge",
      input: {
        forgeRunId: "forge-run-2",
        taskId: "task-runtime-2",
        task: forgeTask({ targetBranch: "main" }),
        operatorContext: {
          source: "forge",
          operatorId: "user-001",
          tenantId: "tenant-001",
          orgId: "org-001",
          roles: ["OPS_ADMIN"],
          scope: "task",
          runId: "forge-run-2",
          taskId: "task-runtime-2"
        }
      }
    },
    requestJson,
    logger: { warn: () => {} },
    tenantId: "tenant-001"
  });

  assert.equal(result.requiresHumanReview, true);
  assert.equal(calls[0].body.result.payload.policy.decision, "deny");
});

test("forge specialized handler validates proposed files through patch planner", () => {
  const result = executeSpecializedAgent("forge", {
    forgeRunId: "run-runtime-patch",
    taskId: "task-runtime-patch",
    action: "code.implement",
    task: forgeTask({
      requestedRole: "backend-builder",
      allowedFiles: ["packages/api/src/**"]
    }),
    proposedFiles: [
      { path: "packages/api/src/forge/controller.ts", operation: "update", content: "export class Controller {}" }
    ],
    operatorContext: {
      source: "forge",
      operatorId: "user-001",
      tenantId: "tenant-001",
      orgId: "org-001",
      roles: ["OPS_ADMIN"],
      scope: "task",
      runId: "run-runtime-patch",
      taskId: "task-runtime-patch"
    },
    environment: "sandbox"
  });

  assert.equal(result.payload.policy.decision, "allow");
  assert.equal(result.payload.patch?.decision, "allow");
  assert.equal(result.payload.patch?.changes[0]?.allowed, true);
});

test("forge specialized handler validates action through tool adapter", () => {
  const result = executeSpecializedAgent("forge", {
    forgeRunId: "run-runtime-tools",
    taskId: "task-runtime-tools",
    action: "code.implement",
    task: forgeTask({
      requestedRole: "backend-builder",
      allowedFiles: ["packages/api/src/**"]
    }),
    operatorContext: {
      source: "forge",
      operatorId: "user-001",
      tenantId: "tenant-001",
      orgId: "org-001",
      roles: ["OPS_ADMIN"],
      scope: "task",
      runId: "run-runtime-tools",
      taskId: "task-runtime-tools"
    },
    environment: "sandbox"
  });

  assert.equal(result.payload.policy.decision, "allow");
  assert.equal(result.payload.tools?.decision, "allow");
  assert.ok(result.payload.tools?.tools.some((t) => t.name === "code.write" && t.allowed));
});

test("forge specialized handler includes verification matrix in payload", () => {
  const result = executeSpecializedAgent("forge", {
    forgeRunId: "run-runtime-verification",
    taskId: "task-runtime-verification",
    action: "code.implement",
    task: forgeTask({
      requestedRole: "backend-builder",
      allowedFiles: ["packages/api/src/**"],
      acceptanceCriteria: [
        { id: "ac-spec", statement: "Spec must be indexed", verification: "pnpm spec:index", required: true }
      ]
    }),
    proposedFiles: [
      { path: "packages/api/src/forge/controller.ts", operation: "create", content: "export class Controller {}" }
    ],
    operatorContext: {
      source: "forge",
      operatorId: "user-001",
      tenantId: "tenant-001",
      orgId: "org-001",
      roles: ["OPS_ADMIN"],
      scope: "task",
      runId: "run-runtime-verification",
      taskId: "task-runtime-verification"
    },
    environment: "sandbox"
  });

  assert.equal(result.payload.policy.decision, "allow");
  assert.ok(result.payload.verification, "payload should include verification");
  assert.equal(result.payload.verification.passed, true);
  assert.equal(result.payload.verification.items[0].status, "passed");
  assert.ok(result.payload.prPackage, "payload should include prPackage");
  assert.equal(result.payload.prPackage.decision, "allow");
  assert.equal(result.payload.prPackage.headBranch, "agent/forge-runtime-docs");
  assert.equal(result.payload.prPackage.changedFiles.length, 1);
});

test("forge specialized handler simulates patch application through patch writer", () => {
  const result = executeSpecializedAgent("forge", {
    forgeRunId: "run-runtime-patchwriter",
    taskId: "task-runtime-patchwriter",
    action: "code.implement",
    task: forgeTask({
      requestedRole: "backend-builder",
      allowedFiles: ["packages/api/src/**"]
    }),
    proposedFiles: [
      { path: "packages/api/src/forge/controller.ts", operation: "create", content: "export class Controller {}" }
    ],
    operatorContext: {
      source: "forge",
      operatorId: "user-001",
      tenantId: "tenant-001",
      orgId: "org-001",
      roles: ["OPS_ADMIN"],
      scope: "task",
      runId: "run-runtime-patchwriter",
      taskId: "task-runtime-patchwriter"
    },
    environment: "sandbox"
  });

  assert.equal(result.payload.policy.decision, "allow");
  assert.ok(result.payload.patchResult, "payload should include patchResult");
  assert.equal(result.payload.patchResult?.decision, "allow");
  assert.equal(result.payload.patchResult?.results[0]?.newContent, "export class Controller {}");
});

test("forge specialized handler includes deployment plan for deployment.propose", () => {
  const result = executeSpecializedAgent("forge", {
    forgeRunId: "run-runtime-deployment",
    taskId: "task-runtime-deployment",
    action: "deployment.propose",
    task: forgeTask({
      requestedRole: "devops-release",
      environment: "staging",
      targetBranch: "main",
      riskLevel: "medium",
      allowedFiles: ["infra/**", ".github/**"]
    }),
    operatorContext: {
      source: "forge",
      operatorId: "user-001",
      tenantId: "tenant-001",
      orgId: "org-001",
      roles: ["OPS_ADMIN"],
      scope: "task",
      runId: "run-runtime-deployment",
      taskId: "task-runtime-deployment"
    },
    environment: "sandbox"
  });

  assert.equal(result.payload.policy.decision, "require_approval");
  assert.ok(result.payload.deployment, "payload should include deployment");
  assert.equal(result.payload.deployment.environment, "staging");
  assert.equal(result.payload.deployment.decision, "require_approval");
  assert.ok(result.payload.deployment.steps.includes("deploy:staging"));
});

test("forge specialized handler includes rollback plan for rollback.prepare", () => {
  const result = executeSpecializedAgent("forge", {
    forgeRunId: "run-runtime-rollback",
    taskId: "task-runtime-rollback",
    action: "rollback.prepare",
    task: forgeTask({
      requestedRole: "devops-release",
      environment: "staging",
      targetBranch: "main",
      riskLevel: "medium",
      allowedFiles: ["infra/**", ".github/**"]
    }),
    operatorContext: {
      source: "forge",
      operatorId: "user-001",
      tenantId: "tenant-001",
      orgId: "org-001",
      roles: ["OPS_ADMIN"],
      scope: "task",
      runId: "run-runtime-rollback",
      taskId: "task-runtime-rollback"
    },
    environment: "sandbox"
  });

  assert.equal(result.payload.policy.decision, "require_approval");
  assert.ok(result.payload.rollback, "payload should include rollback");
  assert.equal(result.payload.rollback.environment, "staging");
  assert.equal(result.payload.rollback.decision, "require_approval");
  assert.ok(result.payload.rollback.steps.includes("restore_release"));
  assert.ok(result.payload.rollback.steps.includes("verify_health"));
});

test("forge specialized handler skips verification for read-only tasks without proposed files", () => {
  const result = executeSpecializedAgent("forge", {
    forgeRunId: "run-runtime-readonly",
    taskId: "task-runtime-readonly",
    action: "runtime.execute",
    task: forgeTask({
      requestedRole: "documentation-curator",
      allowedCommands: ["git status"],
      acceptanceCriteria: [
        { id: "ac-readonly", statement: "Tests must pass", verification: "pnpm test:unit", required: true }
      ]
    }),
    operatorContext: {
      source: "forge",
      operatorId: "user-001",
      tenantId: "tenant-001",
      orgId: "org-001",
      roles: ["OPS_ADMIN"],
      scope: "task",
      runId: "run-runtime-readonly",
      taskId: "task-runtime-readonly"
    },
    environment: "sandbox"
  });

  assert.equal(result.payload.policy.decision, "allow");
  assert.equal(result.payload.verification, undefined);
});
