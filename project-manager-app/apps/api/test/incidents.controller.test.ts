import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { IncidentsController } from "../dist/modules/incidents/incidents.controller.js";

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: { "x-request-id": "req_inc_1" },
    authContext: {
      tenantId: "tenant_1",
      orgId: "org_worker_1",
      userId: "usr_worker_1",
      roles: ["PRO"],
    },
    ...overrides,
  };
}

const STUB_INCIDENT = {
  id: "inc_1",
  jobId: "job_1",
  type: "safety",
  severity: "high",
  title: "Exposed wiring found",
  tenantId: "tenant_1",
  status: "open",
  reportedBy: "usr_worker_1",
  createdAt: new Date().toISOString(),
};

// ── Permission declarations ───────────────────────────────────────────────────

test("incidents controller declares correct @RequirePermissions", () => {
  const expectations: Array<[string, string]> = [
    ["listByWorker", "jobs:read"],
    ["listByJob",    "jobs:read"],
    ["listAll",      "ops:read"],
    ["create",       "jobs:create"],
    ["resolve",      "ops:write"],
  ];

  for (const [method, permission] of expectations) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, IncidentsController.prototype[method]);
    assert.deepEqual(meta, [permission], `${method} should require ${permission}`);
  }
});

// ── listByWorker ──────────────────────────────────────────────────────────────

test("incidents controller: listByWorker passes tenantId and userId to service", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new IncidentsController({
    async listByWorker(opts: Record<string, unknown>) {
      calls.push(opts);
      return [STUB_INCIDENT];
    },
    async listByJob() { return []; },
    async listAll() { return []; },
    async create() { return STUB_INCIDENT; },
    async resolve() { return { resolved: true }; },
  } as never);

  const result = await controller.listByWorker(makeReq() as never);
  assert.equal(result.requestId, "req_inc_1");
  assert.equal(result.data.length, 1);
  assert.equal(calls[0]?.tenantId, "tenant_1");
  assert.equal(calls[0]?.userId, "usr_worker_1");
});

test("incidents controller: listByWorker forwards optional status filter", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new IncidentsController({
    async listByWorker(opts: Record<string, unknown>) {
      calls.push(opts);
      return [];
    },
    async listByJob() { return []; },
    async listAll() { return []; },
    async create() { return STUB_INCIDENT; },
    async resolve() { return {}; },
  } as never);

  await controller.listByWorker(makeReq() as never, "open");
  assert.equal(calls[0]?.status, "open");
});

// ── listByJob ─────────────────────────────────────────────────────────────────

test("incidents controller: listByJob passes jobId to service", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new IncidentsController({
    async listByWorker() { return []; },
    async listByJob(opts: Record<string, unknown>) {
      calls.push(opts);
      return [STUB_INCIDENT];
    },
    async listAll() { return []; },
    async create() { return STUB_INCIDENT; },
    async resolve() { return {}; },
  } as never);

  const result = await controller.listByJob(makeReq() as never, "job_abc");
  assert.equal(result.data.length, 1);
  assert.equal(calls[0]?.jobId, "job_abc");
  assert.equal(calls[0]?.tenantId, "tenant_1");
});

// ── listAll ───────────────────────────────────────────────────────────────────

test("incidents controller: listAll forwards status and severity filters", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new IncidentsController({
    async listByWorker() { return []; },
    async listByJob() { return []; },
    async listAll(opts: Record<string, unknown>) {
      calls.push(opts);
      return [STUB_INCIDENT];
    },
    async create() { return STUB_INCIDENT; },
    async resolve() { return {}; },
  } as never);

  const req = makeReq({ authContext: { tenantId: "tenant_1", orgId: "org_1", userId: "u_admin", roles: ["OPS_ADMIN"] } });
  await controller.listAll(req as never, "open", "high");
  assert.equal(calls[0]?.status, "open");
  assert.equal(calls[0]?.severity, "high");
  assert.equal(calls[0]?.tenantId, "tenant_1");
});

// ── create ────────────────────────────────────────────────────────────────────

test("incidents controller: create validates body with zod and routes to service", async () => {
  const calls: unknown[] = [];
  const controller = new IncidentsController({
    async listByWorker() { return []; },
    async listByJob() { return []; },
    async listAll() { return []; },
    async create(data: unknown) {
      calls.push(data);
      return { ...STUB_INCIDENT, id: "inc_new" };
    },
    async resolve() { return {}; },
  } as never);

  const body = {
    jobId: "job_1",
    type: "safety",
    severity: "high",
    title: "Exposed wiring",
    description: "Found during rough-in inspection",
  };
  const result = await controller.create(makeReq() as never, body);
  assert.equal(result.data.id, "inc_new");
  assert.equal(calls.length, 1);
});

test("incidents controller: create rejects invalid type enum", async () => {
  const controller = new IncidentsController({
    async listByWorker() { return []; },
    async listByJob() { return []; },
    async listAll() { return []; },
    async create() { return STUB_INCIDENT; },
    async resolve() { return {}; },
  } as never);

  // "electrical" is not in the enum — should throw
  await assert.rejects(
    () => controller.create(makeReq() as never, {
      jobId: "job_1",
      type: "electrical",
      severity: "high",
      title: "Bad wire",
    }),
    BadRequestException
  );
});

test("incidents controller: create rejects missing required fields", async () => {
  const controller = new IncidentsController({
    async listByWorker() { return []; },
    async listByJob() { return []; },
    async listAll() { return []; },
    async create() { return STUB_INCIDENT; },
    async resolve() { return {}; },
  } as never);

  // Missing jobId and title
  await assert.rejects(
    () => controller.create(makeReq() as never, { type: "safety", severity: "low" }),
    BadRequestException
  );
});

// ── resolve ───────────────────────────────────────────────────────────────────

test("incidents controller: resolve routes incidentId to service", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new IncidentsController({
    async listByWorker() { return []; },
    async listByJob() { return []; },
    async listAll() { return []; },
    async create() { return STUB_INCIDENT; },
    async resolve(opts: Record<string, unknown>) {
      calls.push(opts);
      return { id: opts.incidentId, status: "resolved" };
    },
  } as never);

  const req = makeReq({ authContext: { tenantId: "tenant_1", orgId: "org_1", userId: "u_admin", roles: ["OPS_ADMIN"] } });
  const result = await controller.resolve(req as never, "inc_xyz");
  assert.equal(result.data.status, "resolved");
  assert.equal(calls[0]?.incidentId, "inc_xyz");
  assert.equal(calls[0]?.tenantId, "tenant_1");
});
