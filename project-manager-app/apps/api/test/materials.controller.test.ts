import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { MaterialsController } from "../dist/modules/materials/materials.controller.js";

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: { "x-request-id": "req_mat_1" },
    authContext: {
      tenantId: "tenant_1",
      orgId: "org_1",
      userId: "usr_worker_1",
      roles: ["PRO"],
    },
    ...overrides,
  };
}

const STUB_MATERIAL = {
  id: "mat_1",
  jobId: "job_1",
  item: "2x4 studs",
  quantity: 50,
  unit: "pieces",
  estimatedCost: 150,
  status: "requested",
  requestedBy: "usr_worker_1",
};

// ── Permission declarations ───────────────────────────────────────────────────

test("materials controller declares correct @RequirePermissions", () => {
  const expectations: Array<[string, string]> = [
    ["listByWorker", "jobs:read"],
    ["listByJob",    "jobs:read"],
    ["listAll",      "ops:read"],
    ["create",       "jobs:create"],
    ["approve",      "ops:write"],
  ];

  for (const [method, permission] of expectations) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, MaterialsController.prototype[method]);
    assert.deepEqual(meta, [permission], `${method} should require ${permission}`);
  }
});

// ── listByWorker ──────────────────────────────────────────────────────────────

test("materials controller: listByWorker forwards tenantId, userId, optional status", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new MaterialsController({
    async listByWorker(opts: Record<string, unknown>) {
      calls.push(opts);
      return [STUB_MATERIAL];
    },
    async listByJob() { return []; },
    async listAll() { return []; },
    async create() { return STUB_MATERIAL; },
    async approve() { return { ...STUB_MATERIAL, status: "approved" }; },
  } as never);

  const result = await controller.listByWorker(makeReq() as never, "requested");
  assert.equal(result.requestId, "req_mat_1");
  assert.equal(result.data.length, 1);
  assert.equal(calls[0]?.tenantId, "tenant_1");
  assert.equal(calls[0]?.userId, "usr_worker_1");
  assert.equal(calls[0]?.status, "requested");
});

// ── listByJob ─────────────────────────────────────────────────────────────────

test("materials controller: listByJob passes jobId and tenantId to service", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new MaterialsController({
    async listByWorker() { return []; },
    async listByJob(opts: Record<string, unknown>) {
      calls.push(opts);
      return [STUB_MATERIAL];
    },
    async listAll() { return []; },
    async create() { return STUB_MATERIAL; },
    async approve() { return STUB_MATERIAL; },
  } as never);

  const result = await controller.listByJob(makeReq() as never, "job_xyz");
  assert.equal(result.data.length, 1);
  assert.equal(calls[0]?.jobId, "job_xyz");
  assert.equal(calls[0]?.tenantId, "tenant_1");
});

// ── listAll ───────────────────────────────────────────────────────────────────

test("materials controller: listAll forwards optional status filter", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new MaterialsController({
    async listByWorker() { return []; },
    async listByJob() { return []; },
    async listAll(opts: Record<string, unknown>) {
      calls.push(opts);
      return [STUB_MATERIAL];
    },
    async create() { return STUB_MATERIAL; },
    async approve() { return STUB_MATERIAL; },
  } as never);

  const adminReq = makeReq({ authContext: { tenantId: "tenant_1", orgId: "org_1", userId: "u_admin", roles: ["OPS_ADMIN"] } });
  await controller.listAll(adminReq as never, "pending_approval");
  assert.equal(calls[0]?.status, "pending_approval");
  assert.equal(calls[0]?.tenantId, "tenant_1");
});

// ── create ────────────────────────────────────────────────────────────────────

test("materials controller: create validates body and routes to service", async () => {
  const calls: unknown[] = [];
  const controller = new MaterialsController({
    async listByWorker() { return []; },
    async listByJob() { return []; },
    async listAll() { return []; },
    async create(data: unknown) {
      calls.push(data);
      return { ...STUB_MATERIAL, id: "mat_new" };
    },
    async approve() { return STUB_MATERIAL; },
  } as never);

  const body = { jobId: "job_1", item: "Drywall sheets", quantity: 20, unit: "sheets", estimatedCost: 400 };
  const result = await controller.create(makeReq() as never, body);
  assert.equal(result.data.id, "mat_new");
  assert.equal(calls.length, 1);
});

test("materials controller: create rejects missing required fields", async () => {
  const controller = new MaterialsController({
    async listByWorker() { return []; },
    async listByJob() { return []; },
    async listAll() { return []; },
    async create() { return STUB_MATERIAL; },
    async approve() { return STUB_MATERIAL; },
  } as never);

  // Missing item, quantity, unit
  await assert.rejects(
    () => controller.create(makeReq() as never, { jobId: "job_1" }),
    BadRequestException
  );
});

test("materials controller: create rejects non-positive quantity", async () => {
  const controller = new MaterialsController({
    async listByWorker() { return []; },
    async listByJob() { return []; },
    async listAll() { return []; },
    async create() { return STUB_MATERIAL; },
    async approve() { return STUB_MATERIAL; },
  } as never);

  await assert.rejects(
    () => controller.create(makeReq() as never, { jobId: "job_1", item: "Studs", quantity: -5, unit: "pcs" }),
    BadRequestException
  );
});

// ── approve ───────────────────────────────────────────────────────────────────

test("materials controller: approve passes requestId param and approvedBy from actor", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new MaterialsController({
    async listByWorker() { return []; },
    async listByJob() { return []; },
    async listAll() { return []; },
    async create() { return STUB_MATERIAL; },
    async approve(opts: Record<string, unknown>) {
      calls.push(opts);
      return { ...STUB_MATERIAL, status: "approved" };
    },
  } as never);

  const adminReq = makeReq({ authContext: { tenantId: "tenant_1", orgId: "org_1", userId: "u_admin", roles: ["OPS_ADMIN"] } });
  const result = await controller.approve(adminReq as never, "mat_1");
  assert.equal(result.data.status, "approved");
  assert.equal(calls[0]?.requestId, "mat_1");
  assert.equal(calls[0]?.approvedBy, "u_admin");
  assert.equal(calls[0]?.tenantId, "tenant_1");
});
