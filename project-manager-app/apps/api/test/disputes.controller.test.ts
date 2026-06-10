import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { DisputesController } from "../dist/modules/disputes/disputes.controller.js";

function createController() {
  const calls: Array<Record<string, unknown>> = [];
  const service = {
    async list(input: Record<string, unknown>) {
      calls.push({ method: "list", input });
      return [{
        id: "dis_1",
        tenantId: String(input.tenantId ?? "tenant_1"),
        jobId: "job_1",
        projectId: "proj_1",
        status: "open",
        reason: "Scope mismatch for approved work",
      }];
    },
    async create(input: Record<string, unknown>) {
      calls.push({ method: "create", input });
      return {
        id: "dis_2",
        tenantId: String(input.tenantId ?? "tenant_1"),
        jobId: String(input.jobId ?? "job_1"),
        projectId: String(input.projectId ?? "proj_1"),
        status: "open",
        reason: String(input.reason ?? "reason"),
      };
    },
    async assign(input: Record<string, unknown>) {
      calls.push({ method: "assign", input });
      return {
        id: String(input.disputeId ?? "dis_1"),
        tenantId: String(input.tenantId ?? "tenant_1"),
        jobId: "job_1",
        projectId: "proj_1",
        status: "assigned",
        reason: "Scope mismatch",
      };
    },
    async submitEvidence(input: Record<string, unknown>) {
      calls.push({ method: "submitEvidence", input });
      return {
        id: String(input.disputeId ?? "dis_1"),
        tenantId: String(input.tenantId ?? "tenant_1"),
        jobId: "job_1",
        projectId: "proj_1",
        status: "open",
        reason: "Scope mismatch",
      };
    },
    async markUnderReview(input: Record<string, unknown>) {
      calls.push({ method: "markUnderReview", input });
      return {
        id: String(input.disputeId ?? "dis_1"),
        tenantId: String(input.tenantId ?? "tenant_1"),
        jobId: "job_1",
        projectId: "proj_1",
        status: "assigned",
        reason: "Scope mismatch",
      };
    },
    async resolve(input: Record<string, unknown>) {
      calls.push({ method: "resolve", input });
      return {
        id: String(input.disputeId ?? "dis_1"),
        tenantId: String(input.tenantId ?? "tenant_1"),
        jobId: "job_1",
        projectId: "proj_1",
        status: "resolved",
        reason: "Scope mismatch",
        resolutionType: input.resolutionType ?? "pro_favor",
      };
    },
    async archive(input: Record<string, unknown>) {
      calls.push({ method: "archive", input });
      return { id: String(input.disputeId ?? "dis_1"), archived: true };
    },
    async restore(input: Record<string, unknown>) {
      calls.push({ method: "restore", input });
      return { id: String(input.disputeId ?? "dis_1"), restored: true };
    },
  } as never;

  return { controller: new DisputesController(service), calls };
}

test("disputes controller declares permissions and wraps visible payloads", async () => {
  const expectations: Array<[string, string]> = [
    ["list", "disputes:read"],
    ["create", "disputes:create"],
    ["assign", "disputes:assign"],
    ["submitEvidence", "disputes:create"],
    ["markUnderReview", "disputes:assign"],
    ["resolve", "disputes:resolve"],
    ["archive", "disputes:archive"],
    ["restore", "disputes:restore"],
  ];

  for (const [methodName, permission] of expectations) {
    const metadata = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, DisputesController.prototype[methodName]);
    assert.deepEqual(metadata, [permission]);
  }

  const { controller, calls } = createController();
  const actor = {
    headers: { "x-request-id": "req_dis_1" },
    authContext: { tenantId: "tenant_1", orgId: "org_ops_1", userId: "usr_ops_1", roles: ["OPS_ADMIN"] },
  };

  const listed = await controller.list(actor as never);
  const created = await controller.create(actor as never, { projectId: "proj_1", jobId: "job_1", reason: "Scope mismatch for approved work" });
  const assigned = await controller.assign(actor as never, "dis_1", { assigneeUserId: "usr_ops_2" });
  const evidenced = await controller.submitEvidence(actor as never, "dis_1", { evidenceIds: ["ev_1", "ev_2"] });
  const reviewed = await controller.markUnderReview(actor as never, "dis_1");
  const resolved = await controller.resolve(actor as never, "dis_1", { resolution: "Resolved in favor of pro", resolutionType: "pro_favor" });
  const archived = await controller.archive(actor as never, "dis_1");
  const restored = await controller.restore(actor as never, "dis_1");

  assert.equal(listed.requestId, "req_dis_1");
  assert.equal(listed.data[0]?.status, "OPEN");
  assert.equal(created.data.status, "OPEN");
  assert.equal(assigned.data.status, "ASSIGNED");
  assert.equal(evidenced.data.status, "OPEN");
  assert.equal(reviewed.data.status, "ASSIGNED");
  assert.equal(resolved.data.status, "RESOLVED");
  assert.deepEqual(archived.data, { id: "dis_1", archived: true });
  assert.deepEqual(restored.data, { id: "dis_1", restored: true });
  assert.ok(calls.some((call) => call.method === "create"));
  assert.ok(calls.some((call) => call.method === "resolve"));
  assert.ok(calls.some((call) => call.method === "restore"));
});
