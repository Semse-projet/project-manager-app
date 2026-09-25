import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { ForgeService } from "../dist/modules/forge/forge.service.js";

// creator-mentor's manifest has approvalMode: "creator_review" (packages/forge/src/registry.ts) —
// evaluateForgePolicy() adds that mode to requiredApprovals for EVERY action
// this role takes, regardless of anything else, since it never looks at
// run.approvals. A task assigned to this role is what actually exercises
// the require_approval -> (approve) -> succeeded transition end to end.
const approvedSpec = {
  id: "forge-test-spec",
  path: "docs/specs/creator/test.spec.md",
  digest: "abc123",
  status: "APPROVED"
};

function creatorTask(overrides = {}) {
  return {
    id: "creator-task",
    title: "Structure creator knowledge",
    spec: approvedSpec,
    requestedRole: "creator-mentor",
    riskLevel: "low",
    objective: "Turn interview notes into curriculum",
    allowedFiles: ["docs/specs/creator/**"],
    forbiddenFiles: [],
    allowedCommands: [],
    acceptanceCriteria: [],
    dependencies: [],
    targetBranch: "agent/creator-test",
    environment: "sandbox",
    metadata: {},
    status: "pending",
    ...overrides
  };
}

function run(tasks) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title: "Test run",
    state: "building",
    spec: approvedSpec,
    tasks,
    assignedAgents: {},
    approvals: [],
    events: [],
    agentRunIds: [],
    createdAt: now,
    updatedAt: now
  };
}

function makeFakeRepository(seedRun) {
  const store = new Map([[seedRun.id, seedRun]]);
  return {
    async findById(input) {
      const found = store.get(input.runId);
      if (!found) throw new Error(`Forge run '${input.runId}' not found`);
      return structuredClone(found);
    },
    async update(input) {
      store.set(input.run.id, structuredClone(input.run));
      return structuredClone(input.run);
    }
  };
}

function makeFakeAuditService() {
  return { async append() {} };
}

function makeFakeLeaseService() {
  return {
    async acquire() {
      return { acquired: true };
    },
    async release() {}
  };
}

const actor = { tenantId: "tenant-1", orgId: "org-1", userId: "requester", roles: [] };
// A distinct approver — Fase 1's anti-self-approval guard rejects
// approve() when the approving actor matches the approval's requestedBy
// (set to the actor who triggered completeTask()).
const approver = { tenantId: "tenant-1", orgId: "org-1", userId: "approver", roles: [] };

test("a task requiring approval unblocks its own status (and dependents) once the approval is granted", async () => {
  const task = creatorTask();
  const seedRun = run([task]);
  const repository = makeFakeRepository(seedRun);
  const service = new ForgeService(repository, {}, makeFakeAuditService(), makeFakeLeaseService());

  const firstResult = await service.completeTask({
    actor,
    runId: seedRun.id,
    taskId: task.id,
    agentRunId: "agent-run-1",
    result: { payload: { action: "curriculum.structure" } },
    requestId: randomUUID()
  });

  const afterFirst = firstResult.tasks.find((t) => t.id === task.id);
  assert.equal(afterFirst.status, "blocked_on_approval");
  assert.equal(
    firstResult.approvals.some((a) => a.mode === "creator_review" && a.status === "pending"),
    true
  );

  await service.decideApproval({
    actor: approver,
    runId: seedRun.id,
    mode: "creator_review",
    decision: "approved",
    requestId: randomUUID()
  });

  const secondResult = await service.completeTask({
    actor,
    runId: seedRun.id,
    taskId: task.id,
    agentRunId: "agent-run-2",
    result: { payload: { action: "curriculum.structure" } },
    requestId: randomUUID()
  });

  const afterSecond = secondResult.tasks.find((t) => t.id === task.id);
  assert.equal(afterSecond.status, "succeeded");
});

test("a task still shows blocked_on_approval on re-submission before anyone approves", async () => {
  const task = creatorTask();
  const seedRun = run([task]);
  const repository = makeFakeRepository(seedRun);
  const service = new ForgeService(repository, {}, makeFakeAuditService(), makeFakeLeaseService());

  await service.completeTask({
    actor,
    runId: seedRun.id,
    taskId: task.id,
    agentRunId: "agent-run-1",
    result: { payload: { action: "curriculum.structure" } },
    requestId: randomUUID()
  });

  const secondResult = await service.completeTask({
    actor,
    runId: seedRun.id,
    taskId: task.id,
    agentRunId: "agent-run-2",
    result: { payload: { action: "curriculum.structure" } },
    requestId: randomUUID()
  });

  const afterSecond = secondResult.tasks.find((t) => t.id === task.id);
  assert.equal(afterSecond.status, "blocked_on_approval");
});
