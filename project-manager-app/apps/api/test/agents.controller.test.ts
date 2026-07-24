import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { agentCatalog } from "@semse/agents";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { AgentsController } from "../dist/modules/agents/agents.controller.js";

function createController() {
  const calls: Array<Record<string, unknown>> = [];
  const agentsService = {
    catalog() {
      calls.push({ method: "catalog" });
      return [{ role: agentCatalog[0] }];
    },
    catalogDetail(agentType: string) {
      calls.push({ method: "catalogDetail", agentType });
      return { role: agentType };
    },
    tools() {
      calls.push({ method: "tools" });
      return ["web", "db"];
    },
    evaluatePolicy(input: Record<string, unknown>) {
      calls.push({ method: "evaluatePolicy", input });
      return { allowed: true, violations: [] };
    },
    listApprovals(input: Record<string, unknown>) {
      calls.push({ method: "listApprovals", input });
      return [{ id: "apr_1", tenantId: String(input.tenantId ?? "tenant_1") }];
    },
    detailApproval(input: Record<string, unknown>) {
      calls.push({ method: "detailApproval", input });
      return { id: String(input.approvalId ?? "apr_1"), tenantId: String(input.tenantId ?? "tenant_1") };
    },
    decideApproval(input: Record<string, unknown>) {
      calls.push({ method: "decideApproval", input });
      return { id: String(input.approvalId ?? "apr_1"), tenantId: String(input.tenantId ?? "tenant_1"), correlationId: "copilot:project_1", decision: String(input.decision ?? "approved") };
    },
    chat(input: Record<string, unknown>) {
      calls.push({ method: "chat", input });
      return { reply: "ok", threadId: String(input.threadId ?? "thr_1") };
    },
    getThreadList(input: Record<string, unknown>) {
      calls.push({ method: "getThreadList", input });
      return [{ threadId: "thr_1" }];
    },
    getThreadMessages(input: Record<string, unknown>) {
      calls.push({ method: "getThreadMessages", input });
      return { threadId: String(input.threadId ?? "thr_1"), messages: [] };
    },
    list(input: Record<string, unknown>) {
      calls.push({ method: "listRuns", input });
      return [{ id: "run_1", tenantId: String(input.tenantId ?? "tenant_1") }];
    },
    detail(input: Record<string, unknown>) {
      calls.push({ method: "detailRun", input });
      return { id: String(input.runId ?? "run_1"), tenantId: String(input.tenantId ?? "tenant_1") };
    },
    create(input: Record<string, unknown>) {
      calls.push({ method: "createRun", input });
      return { id: "run_2", tenantId: String(input.tenantId ?? "tenant_1"), agentType: String(input.agentType ?? "project-copilot") };
    },
    claim(input: Record<string, unknown>) {
      calls.push({ method: "claim", input });
      return { id: "run_3", claimed: true };
    },
    reclaimStale(input: Record<string, unknown>) {
      calls.push({ method: "reclaimStale", input });
      return { reclaimedCount: 1 };
    },
    retry(input: Record<string, unknown>) {
      calls.push({ method: "retry", input });
      return { id: String(input.runId ?? "run_1"), retried: true };
    },
    start(input: Record<string, unknown>) {
      calls.push({ method: "start", input });
      return { id: String(input.runId ?? "run_1"), status: "running" };
    },
    heartbeat(input: Record<string, unknown>) {
      calls.push({ method: "heartbeat", input });
      return { id: String(input.runId ?? "run_1"), status: "running" };
    },
    complete(input: Record<string, unknown>) {
      calls.push({ method: "complete", input });
      return { id: String(input.runId ?? "run_1"), status: "completed" };
    },
    fail(input: Record<string, unknown>) {
      calls.push({ method: "fail", input });
      return { id: String(input.runId ?? "run_1"), status: "failed" };
    },
  } as never;

  const projectCopilotHarness = {
    async executeFromApproval(actor: Record<string, unknown>, requestId: string, approval: Record<string, unknown>) {
      calls.push({ method: "executeFromApproval", actor, requestId, approval });
      return { executed: true, summary: "executed" };
    },
    async run(actor: Record<string, unknown>, requestId: string, input: Record<string, unknown>) {
      calls.push({ method: "copilotRun", actor, requestId, input });
      return { id: "copilot_run_1", kind: String(input.kind ?? "chat") };
    },
  } as never;

  const planModeService = {
    async listByProject(tenantId: string, projectId: string) {
      calls.push({ method: "listByProject", tenantId, projectId });
      return [{ id: "plan_1", tenantId, projectId }];
    },
    async getPlanById(tenantId: string, planId: string) {
      calls.push({ method: "getPlanById", tenantId, planId });
      return { id: planId, tenantId };
    },
    async approvePlan(input: Record<string, unknown>) {
      calls.push({ method: "approvePlan", input });
      return { id: String(input.planId ?? "plan_1"), status: "approved" };
    },
    async rejectPlan(input: Record<string, unknown>) {
      calls.push({ method: "rejectPlan", input });
      return { id: String(input.planId ?? "plan_1"), status: "rejected" };
    },
    async cancelPlan(input: Record<string, unknown>) {
      calls.push({ method: "cancelPlan", input });
      return { id: String(input.planId ?? "plan_1"), status: "cancelled" };
    },
    async startStep(input: Record<string, unknown>) {
      calls.push({ method: "startStep", input });
      return { id: String(input.stepId ?? "step_1"), status: "running" };
    },
    async completeExecutableStep(input: Record<string, unknown>) {
      calls.push({ method: "completeExecutableStep", input });
      return { id: String(input.stepId ?? "step_1"), status: "completed" };
    },
    async blockStep(input: Record<string, unknown>) {
      calls.push({ method: "blockStep", input });
      return { id: String(input.stepId ?? "step_1"), status: "blocked" };
    },
    async retryStep(input: Record<string, unknown>) {
      calls.push({ method: "retryStep", input });
      return { id: String(input.stepId ?? "step_1"), status: "pending" };
    },
    async skipStep(input: Record<string, unknown>) {
      calls.push({ method: "skipStep", input });
      return { id: String(input.stepId ?? "step_1"), status: "skipped" };
    },
  } as never;

  const coordinatorService = {
    async listByProject(input: Record<string, unknown>) {
      calls.push({ method: "listDelegationsByProject", input });
      return { delegations: [] };
    },
    async collectProjectSnapshot(input: Record<string, unknown>) {
      calls.push({ method: "collectProjectSnapshot", input });
      return { delegations: [] };
    },
    async getTask(input: Record<string, unknown>) {
      calls.push({ method: "getTask", input });
      return { id: String(input.delegationId ?? "del_1") };
    },
  } as never;

  const planTemplatesService = {
    listTemplates(category?: string) {
      calls.push({ method: "listTemplates", category });
      return [{ id: "tpl_1", category: category ?? "all" }];
    },
    getCategories() {
      calls.push({ method: "getCategories" });
      return ["general"];
    },
    getTemplate(templateId: string) {
      calls.push({ method: "getTemplate", templateId });
      return { id: templateId };
    },
  } as never;

  return {
    controller: new AgentsController(
      agentsService,
      projectCopilotHarness,
      planModeService,
      coordinatorService,
      planTemplatesService
    ),
    calls
  };
}

test("agents controller declares permissions and wraps representative payloads", async () => {
  const expectations: Array<[string, string]> = [
    ["catalog", "agents:run:create"],
    ["catalogDetail", "agents:run:create"],
    ["tools", "agents:run:create"],
    ["evaluatePolicy", "agents:run:create"],
    ["listApprovals", "ops:dashboard:read"],
    ["detailApproval", "ops:dashboard:read"],
    ["decideApproval", "ops:dashboard:write"],
    ["chat", "agents:run:create"],
    ["listThreads", "agents:run:create"],
    ["getThread", "agents:run:create"],
    ["listRuns", "agents:run:create"],
    ["detail", "agents:run:create"],
    ["workerDetail", "agents:run:worker"],
    ["createRun", "agents:run:create"],
    ["claim", "agents:run:worker"],
    ["reclaimStale", "agents:run:worker"],
    ["retry", "agents:run:retry"],
    ["start", "agents:run:manage"],
    ["heartbeat", "agents:run:worker"],
    ["complete", "agents:run:manage"],
    ["fail", "agents:run:manage"],
    ["listPlans", "agents:run:create"],
    ["getPlan", "agents:run:create"],
    ["approvePlan", "agents:run:create"],
    ["rejectPlan", "agents:run:create"],
    ["cancelPlan", "agents:run:create"],
    ["startPlanStep", "agents:run:create"],
    ["completePlanStep", "agents:run:create"],
    ["blockPlanStep", "agents:run:create"],
    ["retryPlanStep", "agents:run:create"],
    ["skipPlanStep", "agents:run:create"],
    ["listDelegations", "ops:coordinator:read"],
    ["getDelegation", "ops:coordinator:read"],
    ["coordinatorSnapshot", "ops:coordinator:read"],
    ["copilot", "agents:run:create"],
    ["listPlanTemplates", "agents:run:create"],
    ["getPlanTemplateCategories", "agents:run:create"],
    ["getPlanTemplate", "agents:run:create"],
  ];

  for (const [methodName, permission] of expectations) {
    const metadata = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, AgentsController.prototype[methodName]);
    assert.deepEqual(metadata, [permission]);
  }

  const { controller, calls } = createController();
  const actor = {
    headers: { "x-request-id": "req_agents_1", "x-project-id": "proj_1", "x-idempotency-key": "idem_1" },
    authContext: { tenantId: "tenant_1", orgId: "org_1", userId: "usr_1", roles: ["CLIENT"] },
  };

  const catalog = await controller.catalog(actor as never);
  const detail = await controller.catalogDetail(actor as never, agentCatalog[0]);
  const approvals = await controller.listApprovals(actor as never);
  const decided = await controller.decideApproval(actor as never, "apr_1", { decision: "approved", comment: "ok" });
  const chat = await controller.chat(actor as never, { message: "hello", threadId: "thr_1" });
  const runs = await controller.createRun(actor as never, {
    agentType: agentCatalog[0],
    correlationId: "corr_1",
    triggerType: "manual",
    inputSummary: "summary",
  });
  const worker = await controller.workerDetail(actor as never, "run_1");
  const claimed = await controller.claim(actor as never, { workerId: "worker_1" });
  const retried = await controller.retry(actor as never, "run_1");
  const planTemplates = await controller.listPlanTemplates(actor as never, "field");

  assert.equal(catalog.requestId, "req_agents_1");
  assert.equal(catalog.data[0]?.role, agentCatalog[0]);
  assert.equal(detail.data.role, agentCatalog[0]);
  assert.equal(approvals.data[0]?.tenantId, "tenant_1");
  assert.equal(decided.data.executionResult?.executed, true);
  assert.equal(chat.data.threadId, "thr_1");
  assert.equal(runs.data.id, "run_2");
  assert.equal(worker.data.id, "run_1");
  assert.equal(claimed.data.id, "run_3");
  assert.equal(retried.data.retried, true);
  assert.equal(planTemplates.data[0]?.category, "field");
  assert.ok(calls.some((call) => call.method === "catalog"));
  assert.ok(calls.some((call) => call.method === "executeFromApproval"));
  assert.ok(calls.some((call) => call.method === "createRun"));
  assert.ok(calls.some((call) => call.method === "listTemplates"));
});
