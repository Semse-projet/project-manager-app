import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { ProjectsController } from "../dist/modules/projects/projects.controller.js";

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: { "x-request-id": "req_proj_1" },
    authContext: {
      tenantId: "tenant_1",
      orgId: "org_client_1",
      userId: "usr_client_1",
      roles: ["CLIENT"],
    },
    ...overrides,
  };
}

const STUB_PROJECT = {
  id: "proj_1",
  tenantId: "tenant_1",
  jobId: "job_1",
  status: "in_progress",
  title: "Kitchen remodel",
  totalBudget: 15000,
  spentToDate: 5000,
};

const STUB_MILESTONE = {
  id: "ms_1",
  title: "Demo & Framing",
  status: "approved",
  amount: 3000,
};

// ── Permission declarations ───────────────────────────────────────────────────

test("projects controller declares correct @RequirePermissions", () => {
  const expectations: Array<[string, string]> = [
    ["list",          "projects:read"],
    ["detail",        "projects:read"],
    ["payments",      "projects:financials:read"],
    ["escrow",        "projects:financials:read"],
    ["milestones",    "projects:read"],
    ["updateStatus",  "projects:status:update"],
  ];

  for (const [method, permission] of expectations) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, ProjectsController.prototype[method]);
    assert.deepEqual(meta, [permission], `${method} should require ${permission}`);
  }
});

// ── list ──────────────────────────────────────────────────────────────────────

test("projects controller: list validates query schema and routes to service", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new ProjectsController({
    async list(opts: Record<string, unknown>) {
      calls.push(opts);
      return [STUB_PROJECT];
    },
    async detail() { return STUB_PROJECT; },
    async payments() { return []; },
    async escrow() { return {}; },
    async milestones() { return []; },
    async updateStatus() { return STUB_PROJECT; },
  } as never);

  const result = await controller.list(makeReq() as never, { status: "in_progress" });
  assert.equal(result.requestId, "req_proj_1");
  assert.equal(result.data.length, 1);
  assert.equal(calls[0]?.status, "in_progress");
  assert.equal(calls[0]?.tenantId, "tenant_1");
});

test("projects controller: list rejects invalid status value", async () => {
  const controller = new ProjectsController({
    async list() { return []; },
    async detail() { return STUB_PROJECT; },
    async payments() { return []; },
    async escrow() { return {}; },
    async milestones() { return []; },
    async updateStatus() { return STUB_PROJECT; },
  } as never);

  await assert.rejects(
    () => controller.list(makeReq() as never, { status: "unknown_status" }),
    BadRequestException
  );
});

// ── detail ────────────────────────────────────────────────────────────────────

test("projects controller: detail routes projectId to service", async () => {
  const calls: string[] = [];
  const controller = new ProjectsController({
    async list() { return []; },
    async detail({ projectId }: { projectId: string }) {
      calls.push(projectId);
      return { ...STUB_PROJECT, id: projectId };
    },
    async payments() { return []; },
    async escrow() { return {}; },
    async milestones() { return []; },
    async updateStatus() { return STUB_PROJECT; },
  } as never);

  const result = await controller.detail(makeReq() as never, "proj_abc");
  assert.equal(result.data.id, "proj_abc");
  assert.equal(calls[0], "proj_abc");
});

// ── milestones ────────────────────────────────────────────────────────────────

test("projects controller: milestones returns mapped milestones through toVisibleMilestone", async () => {
  const controller = new ProjectsController({
    async list() { return []; },
    async detail() { return STUB_PROJECT; },
    async payments() { return []; },
    async escrow() { return {}; },
    async milestones({ projectId }: { projectId: string }) {
      return [
        { ...STUB_MILESTONE, projectId, evidences: [], approvals: [] },
      ];
    },
    async updateStatus() { return STUB_PROJECT; },
  } as never);

  const result = await controller.milestones(makeReq() as never, "proj_abc");
  assert.equal(result.data.length, 1);
  assert.ok("id" in result.data[0]);
});

// ── escrow ────────────────────────────────────────────────────────────────────

test("projects controller: escrow returns financial summary", async () => {
  const controller = new ProjectsController({
    async list() { return []; },
    async detail() { return STUB_PROJECT; },
    async payments() { return []; },
    async escrow({ projectId }: { projectId: string }) {
      return { projectId, totalFunded: 15000, totalReleased: 5000, held: 10000 };
    },
    async milestones() { return []; },
    async updateStatus() { return STUB_PROJECT; },
  } as never);

  const result = await controller.escrow(makeReq() as never, "proj_abc");
  assert.equal(result.data.totalFunded, 15000);
  assert.equal(result.data.held, 10000);
});

// ── updateStatus ──────────────────────────────────────────────────────────────

test("projects controller: updateStatus validates status enum", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new ProjectsController({
    async list() { return []; },
    async detail() { return STUB_PROJECT; },
    async payments() { return []; },
    async escrow() { return {}; },
    async milestones() { return []; },
    async updateStatus(opts: Record<string, unknown>) {
      calls.push(opts);
      return { ...STUB_PROJECT, status: opts.status };
    },
  } as never);

  const result = await controller.updateStatus(makeReq() as never, "proj_1", { status: "completed" });
  assert.equal(result.data.status, "completed");
  assert.equal(calls[0]?.projectId, "proj_1");
  assert.equal(calls[0]?.status, "completed");
});

test("projects controller: updateStatus rejects invalid status", async () => {
  const controller = new ProjectsController({
    async list() { return []; },
    async detail() { return STUB_PROJECT; },
    async payments() { return []; },
    async escrow() { return {}; },
    async milestones() { return []; },
    async updateStatus() { return STUB_PROJECT; },
  } as never);

  await assert.rejects(
    () => controller.updateStatus(makeReq() as never, "proj_1", { status: "pending" }),
    BadRequestException
  );
});
