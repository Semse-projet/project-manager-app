import test from "node:test";
import assert from "node:assert/strict";
import { BuildOpsService } from "../dist/modules/buildops/buildops.service.js";

const storedProject = {
  id: "bop_1",
  tenantId: "tenant_1",
  orgId: "org_pro_1",
  jobId: null,
  createdBy: "usr_1",
  title: "Kitchen remodel",
  description: null,
  trade: "general",
  projectType: "remodel",
  clientName: "ACME",
  professionalName: "Pro Services",
  location: "Miami",
  budgetEstimate: { toNumber: () => 10000 },
  status: "in_progress",
  riskScore: 10,
  riskLevel: "low",
  startDate: new Date("2026-07-20T00:00:00.000Z"),
  dueDate: null,
  sourceTool: null,
  sourceToolInput: null,
  sourceToolResult: null,
  clientPlanApprovalStatus: "approved",
  clientPlanApprovedAt: null,
  clientPlanApprovedById: null,
  clientPlanApprovalSource: null,
  clientPlanReviewedAt: null,
  clientPlanReviewComment: null,
  legacyPromotionStatus: "promoted",
  legacyPromotedAt: new Date("2026-07-20T00:00:00.000Z"),
  completion: 25,
  createdAt: new Date("2026-07-19T00:00:00.000Z"),
  updatedAt: new Date("2026-07-28T00:00:00.000Z"),
};

function makePrisma() {
  return {
    buildOpsProject: {
      async findMany() {
        return [storedProject];
      },
      async findFirst() {
        return storedProject;
      },
    },
    project: {
      async findMany() {
        return [{ id: "proj_1", promotedFromBuildOpsProjectId: "bop_1" }];
      },
      async findFirst() {
        return { id: "proj_1" };
      },
    },
  };
}

test("BuildOps DTO exposes the canonical project link for list and detail", async () => {
  const service = new BuildOpsService(makePrisma() as never);

  const list = await service.listProjects("tenant_1", "org_pro_1", []);
  assert.equal(list[0]?.canonicalProjectId, "proj_1");

  const detail = await service.getProject("tenant_1", "bop_1", "org_pro_1", []);
  assert.equal(detail.canonicalProjectId, "proj_1");
});
