import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import {
  AgentWorkPlanService,
  assertValidPlanDependencies,
  validatePlanCreationGraph,
} from "../dist/modules/agents/agent-work-plan.service.js";
import { PlanModeService } from "../dist/modules/agents/plan-mode.service.js";

// Regression for the existing Plan Mode contract. The dependency graph must be
// a DAG: otherwise two steps can each wait forever for the other to complete.
const ref = (id: string, dependsOnStepIds: string[] = []) => ({ id, dependsOnStepIds });

function fullStep(id: string, dependsOnStepIds: string[] = []) {
  return {
    id,
    order: 1,
    title: id,
    description: "",
    expectedOutcome: "",
    capability: "searching" as const,
    toolsAllowed: ["read_file"],
    riskLevel: "low" as const,
    requiresApproval: false,
    requiresApprovedPlan: false,
    status: "pending" as const,
    dependsOnStepIds,
  };
}

test("validates branched and out-of-order DAGs without rejecting independent steps", () => {
  assert.doesNotThrow(() => assertValidPlanDependencies([
    ref("publish", ["review", "evidence"]),
    ref("standalone"),
    ref("evidence", ["inspect"]),
    ref("review", ["inspect"]),
    ref("inspect"),
  ]));
  assert.doesNotThrow(() => assertValidPlanDependencies([]));
});

test("rejects duplicate IDs before persistence", () => {
  assert.throws(() => assertValidPlanDependencies([ref("a"), ref("a")]), /duplicado/);
});

test("rejects missing dependencies instead of creating permanently blocked steps", () => {
  assert.throws(() => assertValidPlanDependencies([ref("a", ["missing"])]), /inexistente/);
});

test("rejects self-dependencies and multi-step cycles", () => {
  assert.throws(() => assertValidPlanDependencies([ref("a", ["a"])]), /sí mismo/);
  assert.throws(() => assertValidPlanDependencies([
    ref("a", ["b"]),
    ref("b", ["c"]),
    ref("c", ["a"]),
  ]), /circulares/);
});

test("work-plan creation rejects a cycle without inserting a row", async () => {
  let writes = 0;
  const prisma = { agentWorkPlan: { async create() { writes++; throw new Error("DB should not be reached"); } } };
  const service = new AgentWorkPlanService(prisma as never);
  await assert.rejects(
    service.create({
      tenantId: "tenant_a",
      orgId: "org_a",
      agentId: "prometeo",
      createdBy: "user_a",
      title: "Incorrect cycle",
      steps: [fullStep("a", ["b"]), fullStep("b", ["a"])],
    } as never),
    /circulares/,
  );
  assert.equal(writes, 0);
});

function planRow(steps: ReturnType<typeof fullStep>[]) {
  const now = new Date();
  return {
    id: "plan_1",
    tenantId: "tenant_a",
    orgId: "org_a",
    projectId: "project_a",
    createdBy: "user_a",
    agentId: "prometeo",
    title: "Plan",
    description: null,
    status: "draft",
    version: 1,
    threadId: null,
    contextJson: null,
    metaJson: null,
    stepsJson: steps,
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    createdAt: now,
    updatedAt: now,
  };
}

test("edited dependencies are rejected before updating an existing plan", async () => {
  let writes = 0;
  const row = planRow([fullStep("a"), fullStep("b", ["a"])]);
  const prisma = {
    agentWorkPlan: {
      async findFirst() { return row; },
      async update() { writes++; throw new Error("DB should not be reached"); },
    },
  };
  const service = new AgentWorkPlanService(prisma as never);
  await assert.rejects(
    service.saveGraph({
      tenantId: "tenant_a",
      planId: row.id,
      steps: [fullStep("a", ["b"]), fullStep("b", ["a"])],
    }),
    /circulares/,
  );
  assert.equal(writes, 0);
});

test("legacy invalid graph cannot be approved without a correction", async () => {
  let writes = 0;
  const row = planRow([fullStep("a", ["b"]), fullStep("b", ["a"])]);
  const prisma = {
    agentWorkPlan: {
      async findFirst() { return row; },
      async update() { writes++; throw new Error("DB should not be reached"); },
    },
  };
  const service = new AgentWorkPlanService(prisma as never);
  await assert.rejects(
    service.approve({ tenantId: "tenant_a", planId: row.id, userId: "user_a", orgId: "org_a" }),
    /circulares/,
  );
  assert.equal(writes, 0);
});

test("progress-only updates of legacy plans are not blocked by the new validation", async () => {
  let writes = 0;
  const row = planRow([fullStep("a", ["b"]), fullStep("b", ["a"])]);
  const prisma = {
    agentWorkPlan: {
      async findFirst() { return row; },
      async update({ data }: { data: Record<string, unknown> }) {
        writes++;
        return { ...row, ...data };
      },
    },
  };
  const service = new AgentWorkPlanService(prisma as never);
  const legacy = await service.findById("tenant_a", row.id);
  const result = await service.saveGraph({ tenantId: "tenant_a", planId: row.id, steps: legacy.steps });
  assert.equal(result.id, row.id);
  assert.equal(writes, 1);
});

test("PlanMode rejects an invalid replacement DAG before archiving an active plan or writing memory", async () => {
  let archives = 0;
  let creates = 0;
  let memories = 0;
  const workPlans = {
    async archiveActivePlan() { archives++; throw new Error("must not archive the previous plan"); },
    async create() { creates++; throw new Error("must not insert an invalid plan"); },
  };
  const planMode = new PlanModeService(
    workPlans as never,
    {} as never,
    { async createMemory() { memories++; } } as never,
  );
  const draft = {
    title: "Cyclic replacement",
    goal: "Test",
    rationale: "",
    description: "",
    risks: [],
    requiredEvidence: [],
    successCriteria: [],
    steps: [fullStep("a", ["b"]), fullStep("b", ["a"])],
  };
  await assert.rejects(
    planMode.createPlan({
      tenantId: "tenant_a", orgId: "org_a", projectId: "project_a",
      createdBy: "user_a", agentId: "prometeo", plan: draft,
    } as never),
    /circulares/,
  );
  assert.equal(archives, 0, "no previous-plan state transition on invalid creation");
  assert.equal(creates, 0, "no invalid replacement insert");
  assert.equal(memories, 0, "no false archive memory emitted");
});

test("creation preflight applies the same default IDs and dependencies as persistence", () => {
  const normalized = validatePlanCreationGraph([
    { title: "inspect" } as never,
    { title: "review" } as never,
    { id: "publish", dependsOnStepIds: ["step_2"] },
  ]);
  assert.deepEqual(normalized, [
    { id: "step_1", dependsOnStepIds: [] },
    { id: "step_2", dependsOnStepIds: ["step_1"] },
    { id: "publish", dependsOnStepIds: ["step_2"] },
  ]);
});
