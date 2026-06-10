import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { BuildOpsController } from "../dist/modules/buildops/buildops.controller.js";

function createController() {
  const calls: Array<Record<string, unknown>> = [];
  const buildOpsService = {
    async overview(tenantId: string) {
      calls.push({ method: "overview", tenantId });
      return { tenantId, projects: [] };
    },
    async listProjects(tenantId: string) {
      calls.push({ method: "listProjects", tenantId });
      return [];
    },
    async getProjectHealth(tenantId: string, projectId: string) {
      calls.push({ method: "getProjectHealth", tenantId, projectId });
      return { healthScore: 82, milestoneReadiness: "ready", evidenceStatus: "good", openSignals: 1, blockers: [] };
    },
    async getProject(tenantId: string, projectId: string) {
      calls.push({ method: "getProject", tenantId, projectId });
      return { id: projectId, tenantId };
    },
    async createProject(input: Record<string, unknown>) {
      calls.push({ method: "createProject", input });
      return { id: "bop_1", ...input };
    },
    async createFromToolResult(input: Record<string, unknown>) {
      calls.push({ method: "createFromToolResult", input });
      return { id: "bop_2", ...input };
    },
    async listTasks(tenantId: string, filters: Record<string, unknown>) {
      calls.push({ method: "listTasks", tenantId, filters });
      return [];
    },
    async getTask(tenantId: string, taskId: string) {
      calls.push({ method: "getTask", tenantId, taskId });
      return { id: taskId, tenantId };
    },
    async listMilestones(tenantId: string) {
      calls.push({ method: "listMilestones", tenantId });
      return [];
    },
    async recoverStalePromotions(input: Record<string, unknown>) {
      calls.push({ method: "recoverStalePromotions", input });
      return { recovered: 1 };
    },
  } as never;

  const approvalService = {
    async approveClientPlan(input: Record<string, unknown>) {
      calls.push({ method: "approveClientPlan", input });
      return { id: String(input.buildOpsProjectId ?? "bop_1"), status: "approved" };
    },
    async requestChanges(input: Record<string, unknown>) {
      calls.push({ method: "requestChanges", input });
      return { id: String(input.buildOpsProjectId ?? "bop_1"), status: "changes_requested" };
    },
    async rejectClientPlan(input: Record<string, unknown>) {
      calls.push({ method: "rejectClientPlan", input });
      return { id: String(input.buildOpsProjectId ?? "bop_1"), status: "rejected" };
    },
    async unapproveClientPlan(input: Record<string, unknown>) {
      calls.push({ method: "unapproveClientPlan", input });
      return { id: String(input.buildOpsProjectId ?? "bop_1"), status: "pending_review" };
    },
  } as never;

  const legacyPromotionService = {
    async promoteApprovedPlanToLegacy(input: Record<string, unknown>) {
      calls.push({ method: "promoteApprovedPlanToLegacy", input });
      return { promoted: true, buildOpsProjectId: String(input.buildOpsProjectId ?? "bop_1") };
    },
  } as never;

  const rerunService = {
    async rerunBridge(input: Record<string, unknown>) {
      calls.push({ method: "rerunBridge", input });
      return { rerun: true, buildOpsProjectId: String(input.buildOpsProjectId ?? "bop_1") };
    },
  } as never;

  const ragCtx = {
    async build(input: Record<string, unknown>) {
      calls.push({ method: "ragBuild", input });
      return null;
    },
    buildContextBlock() {
      return "";
    },
    buildCitations() {
      return [];
    },
  } as never;

  return {
    controller: new BuildOpsController(buildOpsService, approvalService, legacyPromotionService, rerunService, ragCtx, undefined),
    calls
  };
}

test("buildops controller declares permissions and wraps representative payloads", async () => {
  const expectations: Array<[string, string]> = [
    ["overview", "projects:read"],
    ["listProjects", "projects:read"],
    ["getProjectHealth", "projects:read"],
    ["detail", "projects:read"],
    ["createProject", "projects:create"],
    ["createFromToolResult", "projects:create"],
    ["listTasks", "projects:read"],
    ["detailTask", "projects:read"],
    ["listMilestones", "projects:read"],
    ["recoverStalePromotions", "ops:dashboard:write"],
    ["approvePlan", "projects:status:update"],
    ["requestPlanChanges", "projects:status:update"],
    ["rejectPlan", "projects:status:update"],
    ["unapprovePlan", "projects:status:update"],
    ["promoteLegacy", "projects:status:update"],
    ["operationalRagQuery", "projects:read"],
    ["rerunBridge", "projects:status:update"],
  ];

  for (const [methodName, permission] of expectations) {
    const metadata = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, BuildOpsController.prototype[methodName]);
    assert.deepEqual(metadata, [permission]);
  }

  const { controller, calls } = createController();
  const actor = {
    headers: { "x-request-id": "req_bop_1" },
    authContext: { tenantId: "tenant_1", orgId: "org_1", userId: "usr_1", roles: ["OPS_ADMIN"] },
  };

  const health = await controller.getProjectHealth(actor as never, "proj_1");
  const created = await controller.createFromToolResult(actor as never, {
    sourceTool: "pricing",
    sourceToolInput: { jobId: "job_1" },
    sourceToolResult: { milestones: [] },
    title: "Project from tool",
  });
  const approved = await controller.approvePlan(actor as never, "bop_1", { source: "admin_override" });
  const rag = await controller.operationalRagQuery(actor as never, "proj_1", { question: "" });
  const rerun = await controller.rerunBridge(actor as never, "bop_1");

  assert.equal(health.requestId, "req_bop_1");
  assert.equal(health.data.healthScore, 82);
  assert.equal(created.data.id, "bop_2");
  assert.equal(approved.data.status, "approved");
  assert.equal(rag.data.insufficientContext, true);
  assert.equal(rerun.data.rerun, true);
  assert.ok(calls.some((call) => call.method === "createFromToolResult"));
  assert.ok(calls.some((call) => call.method === "approveClientPlan"));
  assert.ok(calls.some((call) => call.method === "rerunBridge"));
});
