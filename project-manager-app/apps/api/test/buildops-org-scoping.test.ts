import test from "node:test";
import assert from "node:assert/strict";
import { BuildOpsService } from "../dist/modules/buildops/buildops.service.js";

// WS-01C G1 finding (point 16, docs/ws-01c/WS-01C-G1-AS-IS-Reconciliation.md):
// every read here used to scope only by tenantId. `projects:read` is held by
// CLIENT and PRO (packages/auth/src/rbac.ts), not just OPS_ADMIN, so any org
// sharing a tenant with another org could read/list the other org's BuildOps
// projects, tasks and milestones. Fixed by adding orgId to every query
// (direct column for BuildOpsProject/BuildOpsTask, via the canonical
// Project's client/pro org for Milestone), with an OPS_ADMIN bypass.

const PROJECT = {
  id: "bop_1", tenantId: "tnt_1", orgId: "org_owner", jobId: null, createdBy: "usr_1",
  title: "Kitchen remodel", description: null, trade: "plumbing", projectType: "remodel",
  clientName: "Jane", professionalName: null, location: "Austin", budgetEstimate: null,
  status: "in_progress", riskScore: 10, riskLevel: "low", startDate: null, dueDate: null,
  sourceTool: null, sourceToolInput: null, sourceToolResult: null,
  clientPlanApprovalStatus: "pending", clientPlanApprovedAt: null, clientPlanApprovedById: null,
  clientPlanApprovalSource: null, clientPlanReviewedAt: null, clientPlanReviewComment: null,
  legacyPromotionStatus: "none", legacyPromotedAt: null, completion: 20,
  createdAt: new Date(), updatedAt: new Date(),
};

const TASK = {
  id: "task_1", tenantId: "tnt_1", orgId: "org_owner", projectId: "bop_1", createdBy: "usr_1",
  title: "Rough-in inspection", description: null, status: "todo", priority: "medium",
  assigneeName: null, assigneeUserId: null, dueDate: null, completion: 0, sourceTool: null,
  evidenceRequired: null, project: { title: "Kitchen remodel" },
  createdAt: new Date(), updatedAt: new Date(),
};

function makePrisma(overrides: { projectFound?: boolean; taskFound?: boolean } = {}) {
  const { projectFound = true, taskFound = true } = overrides;
  return {
    buildOpsProject: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (!projectFound) return null;
        if (where.orgId && where.orgId !== PROJECT.orgId) return null;
        return PROJECT;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.orgId && where.orgId !== PROJECT.orgId) return [];
        return [PROJECT];
      },
    },
    buildOpsTask: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (!taskFound) return null;
        if (where.orgId && where.orgId !== TASK.orgId) return null;
        return TASK;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.orgId && where.orgId !== TASK.orgId) return [];
        return [TASK];
      },
      count: async () => 0,
    },
    project: { findMany: async () => [], findFirst: async () => null },
  } as never;
}

function makeService(overrides?: Parameters<typeof makePrisma>[0]) {
  return new BuildOpsService(makePrisma(overrides), {} as never);
}

test("listProjects excludes another org's project within the same tenant", async () => {
  const service = makeService();
  const result = await service.listProjects("tnt_1", "org_other", []);
  assert.equal(result.length, 0);
});

test("listProjects returns the caller's own org project", async () => {
  const service = makeService();
  const result = await service.listProjects("tnt_1", "org_owner", []);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "bop_1");
});

test("listProjects returns everything for OPS_ADMIN regardless of org", async () => {
  const service = makeService();
  const result = await service.listProjects("tnt_1", "org_other", ["OPS_ADMIN"]);
  assert.equal(result.length, 1);
});

test("getProject 404s for another org's project in the same tenant", async () => {
  const service = makeService();
  await assert.rejects(() => service.getProject("tnt_1", "bop_1", "org_other", []));
});

test("getProject succeeds for the owning org", async () => {
  const service = makeService();
  const result = await service.getProject("tnt_1", "bop_1", "org_owner", []);
  assert.equal(result.id, "bop_1");
});

test("listTasks excludes another org's task within the same tenant", async () => {
  const service = makeService();
  const result = await service.listTasks("tnt_1", "org_other", []);
  assert.equal(result.length, 0);
});

test("getTask 404s for another org's task in the same tenant", async () => {
  const service = makeService();
  await assert.rejects(() => service.getTask("tnt_1", "task_1", "org_other", []));
});

test("getTask succeeds for OPS_ADMIN regardless of org", async () => {
  const service = makeService();
  const result = await service.getTask("tnt_1", "task_1", "org_other", ["OPS_ADMIN"]);
  assert.equal(result.id, "task_1");
});
