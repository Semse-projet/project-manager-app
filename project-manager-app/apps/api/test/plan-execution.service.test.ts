import test from "node:test";
import assert from "node:assert/strict";
import { PlanExecutionService } from "../dist/modules/agents/plan-execution.service.js";
import { PlanToolPolicyService } from "../dist/modules/agents/plan-tool-policy.service.js";

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan_1",
    tenantId: "tnt_t",
    orgId: "org_t",
    projectId: "proj_1",
    createdBy: "usr_1",
    agentId: "project-copilot",
    title: "Plan operativo",
    status: "active",
    steps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeStep(overrides: Record<string, unknown> = {}) {
  return {
    id: "step_1",
    order: 1,
    title: "Buscar evidencia",
    description: "Revisar archivos del milestone.",
    expectedOutcome: "Evidencia localizada.",
    capability: "searching",
    toolsAllowed: ["search_patterns", "read_file", "list_directory"],
    dependsOnStepIds: [],
    requiredEvidence: [],
    riskLevel: "low",
    requiresApproval: false,
    requiresApprovedPlan: false,
    status: "pending",
    ...overrides,
  };
}

function makeService(initialPlan = makePlan()) {
  let plan = initialPlan;
  const repo = {
    async findById() { return plan; },
    async getActivePlan() { return plan; },
    async saveGraph(_input: { steps: unknown; status?: string }) {
      plan = {
        ...plan,
        steps: _input.steps as typeof plan.steps,
        status: (_input.status ?? plan.status) as typeof plan.status,
      };
      return plan;
    },
  };

  return {
    service: new PlanExecutionService(repo as never, new PlanToolPolicyService()),
    getPlan: () => plan,
  };
}

test("step without dependencies becomes ready", async () => {
  const { service } = makeService(makePlan({ steps: [makeStep()] }));
  const plan = await service.refreshPlanState({ tenantId: "tnt_t", planId: "plan_1", evidenceContext: { evidenceCount: 0 } });
  assert.equal(plan.steps[0]?.status, "ready");
});

test("step with incomplete dependency is blocked", async () => {
  const { service } = makeService(makePlan({
    steps: [
      makeStep({ id: "step_a", status: "pending" }),
      makeStep({ id: "step_b", dependsOnStepIds: ["step_a"] }),
    ],
  }));
  const plan = await service.refreshPlanState({ tenantId: "tnt_t", planId: "plan_1", evidenceContext: { evidenceCount: 0 } });
  assert.equal(plan.steps[1]?.status, "blocked");
  assert.match(plan.steps[1]?.blockReason ?? "", /Dependencias pendientes/i);
});

test("step with missing evidence is blocked", async () => {
  const { service } = makeService(makePlan({
    steps: [
      makeStep({
        id: "step_evidence",
        capability: "worker",
        toolsAllowed: ["propose_milestone_approval"],
        requiredEvidence: ["Fotos finales"],
        requiresApprovedPlan: true,
        riskLevel: "medium",
      }),
    ],
  }));
  const plan = await service.refreshPlanState({ tenantId: "tnt_t", planId: "plan_1", evidenceContext: { evidenceCount: 0 } });
  assert.equal(plan.steps[0]?.status, "blocked");
  assert.equal(plan.steps[0]?.evidenceStatus, "missing");
});

test("plan becomes completed when all steps finish", async () => {
  const { service } = makeService(makePlan({
    steps: [
      makeStep({ id: "step_done", status: "ready" }),
    ],
  }));
  const completed = await service.completeStep({
    tenantId: "tnt_t",
    planId: "plan_1",
    stepId: "step_done",
    evidenceContext: { evidenceCount: 0 },
  });
  assert.equal(completed.status, "completed");
  assert.equal(completed.steps[0]?.status, "completed");
});
