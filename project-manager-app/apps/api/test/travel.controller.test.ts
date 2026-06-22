import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { TravelController } from "../dist/modules/travel/travel.controller.js";

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: { "x-request-id": "req_travel_1" },
    authContext: {
      tenantId: "tenant_1",
      orgId: "org_1",
      userId: "usr_worker_1",
      roles: ["PRO"],
    },
    ...overrides,
  };
}

const STUB_ASSIGNMENT = {
  id: "travel_1",
  tenantId: "tenant_1",
  jobId: "job_1",
  destinationCity: "Monterrey",
  departureDate: "2026-07-01",
  status: "PLANNED",
  assignedTo: "usr_worker_1",
};

const STUB_EXPENSE = {
  id: "exp_1",
  travelId: "travel_1",
  category: "meal",
  amount: 150,
  currency: "MXN",
  expenseDate: "2026-07-02",
};

// ── Permission declarations ───────────────────────────────────────────────────

test("travel controller declares correct @RequirePermissions", () => {
  const expectations: Array<[string, string]> = [
    ["listAssignments",  "jobs:read"],
    ["createAssignment", "jobs:create"],
    ["getAssignment",    "jobs:read"],
    ["updateStatus",     "jobs:create"],
    ["listExpenses",     "jobs:read"],
    ["createExpense",    "jobs:create"],
    ["listLodging",      "jobs:read"],
    ["createLodging",    "jobs:create"],
    ["listAdvances",     "jobs:read"],
    ["createAdvance",    "jobs:create"],
    ["getSettlement",    "jobs:read"],
    ["closeSettlement",  "jobs:create"],
  ];

  for (const [method, permission] of expectations) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, TravelController.prototype[method]);
    assert.deepEqual(meta, [permission], `${method} should require ${permission}`);
  }
});

// ── listAssignments ───────────────────────────────────────────────────────────

test("travel controller: listAssignments routes to service with filters", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new TravelController({
    async listAssignments(opts: Record<string, unknown>) {
      calls.push(opts);
      return [STUB_ASSIGNMENT];
    },
    async createAssignment() { return STUB_ASSIGNMENT; },
    async getAssignment() { return STUB_ASSIGNMENT; },
    async updateAssignmentStatus() { return STUB_ASSIGNMENT; },
    async listExpenses() { return []; },
    async createExpense() { return STUB_EXPENSE; },
    async listLodging() { return []; },
    async createLodging() { return {}; },
    async listAdvances() { return []; },
    async createAdvance() { return {}; },
    async computeSettlement() { return {}; },
    async closeSettlement() { return {}; },
  } as never);

  const result = await controller.listAssignments(makeReq() as never, "PLANNED", "job_1", undefined, "own");
  assert.equal(result.requestId, "req_travel_1");
  assert.equal(result.data.length, 1);
  assert.equal(calls[0]?.status, "PLANNED");
  assert.equal(calls[0]?.jobId, "job_1");
  assert.equal(calls[0]?.scope, "own");
});

// ── createAssignment ──────────────────────────────────────────────────────────

test("travel controller: createAssignment validates required fields", async () => {
  const calls: unknown[] = [];
  const controller = new TravelController({
    async listAssignments() { return []; },
    async createAssignment(data: unknown) {
      calls.push(data);
      return { ...STUB_ASSIGNMENT, id: "travel_new" };
    },
    async getAssignment() { return STUB_ASSIGNMENT; },
    async updateAssignmentStatus() { return STUB_ASSIGNMENT; },
    async listExpenses() { return []; },
    async createExpense() { return STUB_EXPENSE; },
    async listLodging() { return []; },
    async createLodging() { return {}; },
    async listAdvances() { return []; },
    async createAdvance() { return {}; },
    async computeSettlement() { return {}; },
    async closeSettlement() { return {}; },
  } as never);

  const validBody = { jobId: "job_1", destinationCity: "CDMX", departureDate: "2026-07-01" };
  const result = await controller.createAssignment(makeReq() as never, validBody);
  assert.equal(result.data.id, "travel_new");
  assert.equal(calls.length, 1);
});

test("travel controller: createAssignment rejects missing required fields", async () => {
  const controller = new TravelController({
    async listAssignments() { return []; },
    async createAssignment() { return STUB_ASSIGNMENT; },
    async getAssignment() { return STUB_ASSIGNMENT; },
    async updateAssignmentStatus() { return STUB_ASSIGNMENT; },
    async listExpenses() { return []; },
    async createExpense() { return STUB_EXPENSE; },
    async listLodging() { return []; },
    async createLodging() { return {}; },
    async listAdvances() { return []; },
    async createAdvance() { return {}; },
    async computeSettlement() { return {}; },
    async closeSettlement() { return {}; },
  } as never);

  // Missing destinationCity and departureDate
  await assert.rejects(
    () => controller.createAssignment(makeReq() as never, { jobId: "job_1" }),
    BadRequestException
  );
});

// ── updateStatus ──────────────────────────────────────────────────────────────

test("travel controller: updateStatus validates status enum", async () => {
  const controller = new TravelController({
    async listAssignments() { return []; },
    async createAssignment() { return STUB_ASSIGNMENT; },
    async getAssignment() { return STUB_ASSIGNMENT; },
    async updateAssignmentStatus() { return { ...STUB_ASSIGNMENT, status: "ACTIVE" }; },
    async listExpenses() { return []; },
    async createExpense() { return STUB_EXPENSE; },
    async listLodging() { return []; },
    async createLodging() { return {}; },
    async listAdvances() { return []; },
    async createAdvance() { return {}; },
    async computeSettlement() { return {}; },
    async closeSettlement() { return {}; },
  } as never);

  // Valid status
  const result = await controller.updateStatus(makeReq() as never, "travel_1", { status: "ACTIVE" });
  assert.equal(result.data.status, "ACTIVE");

  // Invalid status
  await assert.rejects(
    () => controller.updateStatus(makeReq() as never, "travel_1", { status: "INVALID_STATUS" }),
    BadRequestException
  );
});

// ── createExpense ─────────────────────────────────────────────────────────────

test("travel controller: createExpense validates category enum", async () => {
  const calls: unknown[] = [];
  const controller = new TravelController({
    async listAssignments() { return []; },
    async createAssignment() { return STUB_ASSIGNMENT; },
    async getAssignment() { return STUB_ASSIGNMENT; },
    async updateAssignmentStatus() { return STUB_ASSIGNMENT; },
    async listExpenses() { return []; },
    async createExpense(data: unknown) {
      calls.push(data);
      return { ...STUB_EXPENSE, id: "exp_new" };
    },
    async listLodging() { return []; },
    async createLodging() { return {}; },
    async listAdvances() { return []; },
    async createAdvance() { return {}; },
    async computeSettlement() { return {}; },
    async closeSettlement() { return {}; },
  } as never);

  const validExpense = { category: "meal", amount: 200, expenseDate: "2026-07-02" };
  const result = await controller.createExpense(makeReq() as never, "travel_1", validExpense);
  assert.equal(result.data.id, "exp_new");

  // Invalid category
  await assert.rejects(
    () => controller.createExpense(makeReq() as never, "travel_1", { category: "invalid", amount: 100, expenseDate: "2026-07-02" }),
    BadRequestException
  );
});

// ── settlement ────────────────────────────────────────────────────────────────

test("travel controller: getSettlement returns settlement summary", async () => {
  const controller = new TravelController({
    async listAssignments() { return []; },
    async createAssignment() { return STUB_ASSIGNMENT; },
    async getAssignment() { return STUB_ASSIGNMENT; },
    async updateAssignmentStatus() { return STUB_ASSIGNMENT; },
    async listExpenses() { return []; },
    async createExpense() { return STUB_EXPENSE; },
    async listLodging() { return []; },
    async createLodging() { return {}; },
    async listAdvances() { return []; },
    async createAdvance() { return {}; },
    async computeSettlement(_opts: Record<string, unknown>) {
      return { travelId: "travel_1", totalExpenses: 500, totalAdvances: 300, balance: 200, currency: "MXN" };
    },
    async closeSettlement() { return {}; },
  } as never);

  const result = await controller.getSettlement(makeReq() as never, "travel_1");
  assert.equal(result.data.travelId, "travel_1");
  assert.equal(result.data.balance, 200);
});

test("travel controller: closeSettlement accepts optional notes", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new TravelController({
    async listAssignments() { return []; },
    async createAssignment() { return STUB_ASSIGNMENT; },
    async getAssignment() { return STUB_ASSIGNMENT; },
    async updateAssignmentStatus() { return STUB_ASSIGNMENT; },
    async listExpenses() { return []; },
    async createExpense() { return STUB_EXPENSE; },
    async listLodging() { return []; },
    async createLodging() { return {}; },
    async listAdvances() { return []; },
    async createAdvance() { return {}; },
    async computeSettlement() { return {}; },
    async closeSettlement(opts: Record<string, unknown>) {
      calls.push(opts);
      return { status: "CLOSED", closedAt: new Date().toISOString() };
    },
  } as never);

  const result = await controller.closeSettlement(makeReq() as never, "travel_1", { notes: "All receipts verified" });
  assert.equal(result.data.status, "CLOSED");
  assert.equal(calls[0]?.notes, "All receipts verified");
  assert.equal(calls[0]?.travelId, "travel_1");
});
