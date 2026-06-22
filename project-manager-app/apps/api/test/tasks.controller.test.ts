import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { TasksController } from "../dist/modules/tasks/tasks.controller.js";

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: { "x-request-id": "req_task_1" },
    authContext: {
      tenantId: "tenant_1",
      orgId: "org_1",
      userId: "usr_worker_1",
      roles: ["PRO"],
    },
    ...overrides,
  };
}

const STUB_TASK = {
  id: "task_1",
  tenantId: "tenant_1",
  jobId: "job_1",
  milestone: "Framing",
  title: "Install top plates",
  status: "pending",
  priority: "high",
  createdBy: "usr_worker_1",
};

// ── Permission declarations ───────────────────────────────────────────────────

test("tasks controller declares correct @RequirePermissions", () => {
  const expectations: Array<[string, string]> = [
    ["listByWorker", "jobs:read"],
    ["listByJob",    "jobs:read"],
    ["create",       "jobs:create"],
    ["updateStatus", "jobs:update"],
  ];

  for (const [method, permission] of expectations) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, TasksController.prototype[method]);
    assert.deepEqual(meta, [permission], `${method} should require ${permission}`);
  }
});

// ── listByWorker ──────────────────────────────────────────────────────────────

test("tasks controller: listByWorker forwards tenantId, userId, and optional status", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new TasksController({
    async listByWorker(opts: Record<string, unknown>) {
      calls.push(opts);
      return [STUB_TASK];
    },
    async listByJob() { return []; },
    async create() { return STUB_TASK; },
    async updateStatus() { return STUB_TASK; },
  } as never);

  const result = await controller.listByWorker(makeReq() as never, "pending");
  assert.equal(result.requestId, "req_task_1");
  assert.equal(result.data.length, 1);
  assert.equal(calls[0]?.tenantId, "tenant_1");
  assert.equal(calls[0]?.userId, "usr_worker_1");
  assert.equal(calls[0]?.status, "pending");
});

test("tasks controller: listByWorker works without status filter", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new TasksController({
    async listByWorker(opts: Record<string, unknown>) {
      calls.push(opts);
      return [];
    },
    async listByJob() { return []; },
    async create() { return STUB_TASK; },
    async updateStatus() { return STUB_TASK; },
  } as never);

  await controller.listByWorker(makeReq() as never);
  assert.equal(calls[0]?.status, undefined);
});

// ── listByJob ─────────────────────────────────────────────────────────────────

test("tasks controller: listByJob routes jobId param to service", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new TasksController({
    async listByWorker() { return []; },
    async listByJob(opts: Record<string, unknown>) {
      calls.push(opts);
      return [STUB_TASK];
    },
    async create() { return STUB_TASK; },
    async updateStatus() { return STUB_TASK; },
  } as never);

  const result = await controller.listByJob(makeReq() as never, "job_abc");
  assert.equal(result.data.length, 1);
  assert.equal(calls[0]?.jobId, "job_abc");
  assert.equal(calls[0]?.tenantId, "tenant_1");
});

// ── create ────────────────────────────────────────────────────────────────────

test("tasks controller: create validates required fields and routes to service", async () => {
  const calls: unknown[] = [];
  const controller = new TasksController({
    async listByWorker() { return []; },
    async listByJob() { return []; },
    async create(data: unknown) {
      calls.push(data);
      return { ...STUB_TASK, id: "task_new" };
    },
    async updateStatus() { return STUB_TASK; },
  } as never);

  const body = {
    jobId: "job_1",
    milestone: "Framing",
    title: "Install top plates",
    priority: "high",
  };
  const result = await controller.create(makeReq() as never, body);
  assert.equal(result.data.id, "task_new");
  assert.equal(calls.length, 1);
});

test("tasks controller: create rejects missing required jobId", async () => {
  const controller = new TasksController({
    async listByWorker() { return []; },
    async listByJob() { return []; },
    async create() { return STUB_TASK; },
    async updateStatus() { return STUB_TASK; },
  } as never);

  await assert.rejects(
    () => controller.create(makeReq() as never, { milestone: "Framing", title: "Task" }),
    BadRequestException
  );
});

test("tasks controller: create rejects invalid priority value", async () => {
  const controller = new TasksController({
    async listByWorker() { return []; },
    async listByJob() { return []; },
    async create() { return STUB_TASK; },
    async updateStatus() { return STUB_TASK; },
  } as never);

  await assert.rejects(
    () => controller.create(makeReq() as never, {
      jobId: "job_1",
      milestone: "Framing",
      title: "Task",
      priority: "urgent",  // not in enum
    }),
    BadRequestException
  );
});

// ── updateStatus ──────────────────────────────────────────────────────────────

test("tasks controller: updateStatus transitions task to valid status", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new TasksController({
    async listByWorker() { return []; },
    async listByJob() { return []; },
    async create() { return STUB_TASK; },
    async updateStatus(opts: Record<string, unknown>) {
      calls.push(opts);
      return { ...STUB_TASK, status: opts.status };
    },
  } as never);

  const result = await controller.updateStatus(makeReq() as never, "task_1", { status: "in_progress" });
  assert.equal(result.data.status, "in_progress");
  assert.equal(calls[0]?.taskId, "task_1");
  assert.equal(calls[0]?.status, "in_progress");
  assert.equal(calls[0]?.tenantId, "tenant_1");
});

test("tasks controller: updateStatus rejects invalid status", async () => {
  const controller = new TasksController({
    async listByWorker() { return []; },
    async listByJob() { return []; },
    async create() { return STUB_TASK; },
    async updateStatus() { return STUB_TASK; },
  } as never);

  await assert.rejects(
    () => controller.updateStatus(makeReq() as never, "task_1", { status: "completed" }),  // not in enum
    BadRequestException
  );
});

test("tasks controller: updateStatus all valid statuses accepted", async () => {
  const validStatuses = ["pending", "in_progress", "done", "blocked"];
  const controller = new TasksController({
    async listByWorker() { return []; },
    async listByJob() { return []; },
    async create() { return STUB_TASK; },
    async updateStatus(opts: Record<string, unknown>) {
      return { ...STUB_TASK, status: opts.status };
    },
  } as never);

  for (const status of validStatuses) {
    const result = await controller.updateStatus(makeReq() as never, "task_1", { status });
    assert.equal(result.data.status, status, `status=${status} should be accepted`);
  }
});
