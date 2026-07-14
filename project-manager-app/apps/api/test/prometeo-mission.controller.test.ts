import assert from "node:assert/strict";
import test from "node:test";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import type { WorkPlanRecord } from "../src/modules/agents/agent-work-plan.service.ts";
import { PrometeoMissionController } from "../dist/modules/agents/prometeo-mission.controller.js";
import { PrometeoMissionService } from "../dist/modules/agents/prometeo-mission.service.js";

function createMissionRuntime() {
  let plan: WorkPlanRecord | null = null;
  const now = new Date().toISOString();

  const workPlans = {
    async create(input: Record<string, unknown>) {
      const rawSteps = input.steps as Array<Record<string, unknown>>;
      plan = {
        id: "mission_1",
        tenantId: String(input.tenantId),
        orgId: String(input.orgId),
        projectId: typeof input.projectId === "string" ? input.projectId : undefined,
        createdBy: String(input.createdBy),
        agentId: String(input.agentId),
        title: String(input.title),
        description: String(input.description),
        status: "draft",
        steps: rawSteps.map((step, index) => ({
          id: String(step.id ?? `step_${index + 1}`),
          order: index + 1,
          title: String(step.title),
          description: String(step.description),
          expectedOutcome: String(step.expectedOutcome),
          capability: step.capability as WorkPlanRecord["steps"][number]["capability"],
          toolsAllowed: step.toolsAllowed as string[],
          actionType: typeof step.actionType === "string" ? step.actionType : undefined,
          dependsOnStepIds: step.dependsOnStepIds as string[] | undefined,
          riskLevel: step.riskLevel as "low" | "medium" | "high",
          requiresApproval: Boolean(step.requiresApproval),
          requiresApprovedPlan: Boolean(step.requiresApprovedPlan),
          status: "pending",
        })),
        meta: input.meta as WorkPlanRecord["meta"],
        threadId: typeof input.threadId === "string" ? input.threadId : undefined,
        createdAt: now,
        updatedAt: now,
      };
      return plan;
    },
    async findById() {
      assert.ok(plan);
      return plan;
    },
    async approve() {
      assert.ok(plan);
      plan = { ...plan, status: "active", approvedAt: now, approvedBy: "usr_1", updatedAt: now };
      return plan;
    },
    async saveGraph(input: { steps: WorkPlanRecord["steps"]; status?: WorkPlanRecord["status"] }) {
      assert.ok(plan);
      plan = { ...plan, steps: input.steps, status: input.status ?? plan.status, updatedAt: now };
      return plan;
    },
    async completeStep(input: { stepId: string }) {
      assert.ok(plan);
      plan = {
        ...plan,
        status: "executing",
        steps: plan.steps.map((step) => step.id === input.stepId ? { ...step, status: "completed" } : step),
        updatedAt: now,
      };
      return plan;
    },
    async reject() {
      assert.ok(plan);
      plan = { ...plan, status: "rejected", rejectedAt: now, rejectedBy: "usr_1", updatedAt: now };
      return plan;
    },
    async cancel() {
      assert.ok(plan);
      plan = { ...plan, status: "cancelled", cancelledAt: now, cancelledBy: "usr_1", updatedAt: now };
      return plan;
    },
    async skipStep(input: { stepId: string }) {
      assert.ok(plan);
      plan = {
        ...plan,
        steps: plan.steps.map((step) => step.id === input.stepId ? { ...step, status: "skipped" } : step),
        updatedAt: now,
      };
      return plan;
    },
  };

  const updateStep = (stepId: string, status: WorkPlanRecord["steps"][number]["status"]) => {
    assert.ok(plan);
    plan = {
      ...plan,
      status: "executing",
      steps: plan.steps.map((step) => step.id === stepId ? { ...step, status } : step),
      updatedAt: now,
    };
    return plan;
  };
  const planExecution = {
    async refreshPlanState() {
      assert.ok(plan);
      const firstPending = plan.steps.find((step) => step.status === "pending");
      if (firstPending) return updateStep(firstPending.id, "ready");
      return plan;
    },
    async startStep(input: { stepId: string }) {
      return updateStep(input.stepId, "executing");
    },
    async completeStep(input: { stepId: string }) {
      return updateStep(input.stepId, "completed");
    },
    async blockStep(input: { stepId: string; reason: string }) {
      const updated = updateStep(input.stepId, "blocked");
      plan = {
        ...updated,
        steps: updated.steps.map((step) => step.id === input.stepId
          ? { ...step, blockReason: input.reason, blockedReason: input.reason }
          : step),
      };
      return plan;
    },
    async failStep(input: { stepId: string; reason: string }) {
      const updated = updateStep(input.stepId, "failed");
      plan = {
        ...updated,
        steps: updated.steps.map((step) => step.id === input.stepId
          ? { ...step, blockReason: input.reason, blockedReason: input.reason }
          : step),
      };
      return plan;
    },
    async markStepReady(input: { stepId: string }) {
      return updateStep(input.stepId, "ready");
    },
  };

  return new PrometeoMissionService(workPlans as never, planExecution as never);
}

test("prometeo mission runtime persists approvals and checkpoints through AgentWorkPlan", async () => {
  const runtime = createMissionRuntime();
  const actor = { tenantId: "tenant_1", orgId: "org_1", userId: "usr_1" };
  const created = await runtime.create(actor, {
    goal: "Preparar liberacion de pago",
    projectId: "project_1",
    threadId: "thread_1",
    selectedEntities: [],
    successCriteria: ["Pago preparado sin liberacion automatica."],
    context: {},
    proposedActions: [{
      id: "release-payment",
      namespace: "payments",
      tool: "propose_release",
      label: "Proponer liberacion",
      riskLevel: "critical",
      approvalPolicy: "human_required",
      requiresApproval: true,
      status: "awaiting_approval",
    }],
  });

  assert.equal(created.durable, true);
  assert.equal(created.status, "waiting_approval");
  assert.deepEqual(created.pendingApprovals, ["plan:mission_1"]);

  const approved = await runtime.approve(actor, created.id);
  assert.equal(approved.status, "running");
  assert.equal(approved.steps.find((step) => step.id === "approval")?.status, "completed");

  const actionStepId = approved.steps.find((step) => step.id.startsWith("execute-"))?.id;
  assert.ok(actionStepId);
  const started = await runtime.checkpoint(actor, created.id, actionStepId, {
    action: "start",
    evidenceCount: 0,
  });
  assert.equal(started.steps.find((step) => step.id === actionStepId)?.status, "running");

  const completed = await runtime.checkpoint(actor, created.id, actionStepId, {
    action: "complete",
    evidenceCount: 0,
  });
  assert.equal(completed.steps.find((step) => step.id === actionStepId)?.status, "completed");
  assert.ok((completed.progress?.percent ?? 0) > 0);
});

test("prometeo mission controller validates contracts and declares permissions", async () => {
  for (const methodName of ["create", "get", "approve", "reject", "cancel", "checkpoint"]) {
    const metadata = Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      PrometeoMissionController.prototype[methodName as keyof PrometeoMissionController],
    );
    assert.deepEqual(metadata, ["agents:run:create"]);
  }

  const calls: Array<Record<string, unknown>> = [];
  const missions = {
    async create(actor: Record<string, unknown>, input: Record<string, unknown>) {
      calls.push({ method: "create", actor, input });
      return { id: "mission_2", status: "running", phase: "observe", steps: [], pendingApprovals: [], durable: true };
    },
    async get(tenantId: string, missionId: string) {
      calls.push({ method: "get", tenantId, missionId });
      return { id: missionId, status: "running", phase: "observe", steps: [], pendingApprovals: [], durable: true };
    },
  } as never;
  const controller = new PrometeoMissionController(missions);
  const req = {
    headers: { "x-request-id": "req_mission_1" },
    authContext: { tenantId: "tenant_1", orgId: "org_1", userId: "usr_1", roles: ["CLIENT"] },
  };

  const response = await controller.create(req as never, { goal: "Consultar estado" });
  assert.equal(response.requestId, "req_mission_1");
  assert.equal(response.data.id, "mission_2");
  assert.ok(calls.some((call) => call.method === "create"));
});
