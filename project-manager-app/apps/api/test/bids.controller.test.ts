import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { BidsController, BidsMineController, JobBidsController } from "../dist/modules/bids/bids.controller.js";

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: { "x-request-id": "req_bid_1" },
    authContext: {
      tenantId: "tenant_1",
      orgId: "org_pro_1",
      userId: "usr_pro_1",
      roles: ["PRO"],
    },
    ...overrides,
  };
}

const STUB_BID = {
  id: "bid_1",
  jobId: "job_1",
  proOrgId: "org_pro_1",
  userId: "usr_pro_1",
  amount: 5000,
  etaDays: 14,
  status: "pending",
};

// ── BidsMineController ────────────────────────────────────────────────────────

test("BidsMineController declares 'bids:read' permission on mine()", () => {
  const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, BidsMineController.prototype["mine"]);
  assert.deepEqual(meta, ["bids:read"]);
});

test("BidsMineController: mine() returns bids for current user", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new BidsMineController({
    async listMine(opts: Record<string, unknown>) {
      calls.push(opts);
      return [STUB_BID];
    },
    async list() { return []; },
    async create() { return STUB_BID; },
    async accept() { return STUB_BID; },
  } as never);

  const result = await controller.mine(makeReq() as never);
  assert.equal(result.requestId, "req_bid_1");
  assert.equal(result.data.length, 1);
  assert.equal(calls[0]?.tenantId, "tenant_1");
  assert.equal(calls[0]?.userId, "usr_pro_1");
  assert.equal(calls[0]?.orgId, "org_pro_1");
});

// ── BidsController ────────────────────────────────────────────────────────────

test("BidsController declares 'bids:accept' permission on accept()", () => {
  const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, BidsController.prototype["accept"]);
  assert.deepEqual(meta, ["bids:accept"]);
});

test("BidsController: accept() routes bidId to service and returns accepted bid", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new BidsController({
    async listMine() { return []; },
    async list() { return []; },
    async create() { return STUB_BID; },
    async accept(opts: Record<string, unknown>) {
      calls.push(opts);
      return { ...STUB_BID, status: "accepted" };
    },
  } as never);

  const clientReq = makeReq({
    authContext: { tenantId: "tenant_1", orgId: "org_client_1", userId: "usr_client_1", roles: ["CLIENT"] },
  });
  const result = await controller.accept(clientReq as never, "bid_1");
  assert.equal(result.data.status, "accepted");
  assert.equal(calls[0]?.bidId, "bid_1");
  assert.equal(calls[0]?.tenantId, "tenant_1");
});

// ── JobBidsController ─────────────────────────────────────────────────────────

test("JobBidsController declares correct permissions", () => {
  const expectations: Array<[string, string]> = [
    ["list",   "bids:read"],
    ["create", "bids:create"],
  ];

  for (const [method, permission] of expectations) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, JobBidsController.prototype[method]);
    assert.deepEqual(meta, [permission], `${method} should require ${permission}`);
  }
});

test("JobBidsController: list() returns all bids for job", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new JobBidsController({
    async listMine() { return []; },
    async list(opts: Record<string, unknown>) {
      calls.push(opts);
      return [STUB_BID, { ...STUB_BID, id: "bid_2" }];
    },
    async create() { return STUB_BID; },
    async accept() { return STUB_BID; },
  } as never);

  const result = await controller.list(makeReq() as never, "job_abc");
  assert.equal(result.data.length, 2);
  assert.equal(calls[0]?.jobId, "job_abc");
  assert.equal(calls[0]?.tenantId, "tenant_1");
});

test("JobBidsController: create() validates required fields", async () => {
  const calls: unknown[] = [];
  const controller = new JobBidsController({
    async listMine() { return []; },
    async list() { return []; },
    async create(opts: unknown) {
      calls.push(opts);
      return { ...STUB_BID, id: "bid_new" };
    },
    async accept() { return STUB_BID; },
  } as never);

  const validBody = { amount: 5000, etaDays: 14, note: "We can start Monday" };
  const result = await controller.create(makeReq() as never, "job_1", validBody);
  assert.equal(result.data.id, "bid_new");
  assert.equal(calls.length, 1);
});

test("JobBidsController: create() rejects missing amount", async () => {
  const controller = new JobBidsController({
    async listMine() { return []; },
    async list() { return []; },
    async create() { return STUB_BID; },
    async accept() { return STUB_BID; },
  } as never);

  await assert.rejects(
    () => controller.create(makeReq() as never, "job_1", { etaDays: 14 }),
    BadRequestException
  );
});

test("JobBidsController: create() rejects non-positive amount", async () => {
  const controller = new JobBidsController({
    async listMine() { return []; },
    async list() { return []; },
    async create() { return STUB_BID; },
    async accept() { return STUB_BID; },
  } as never);

  await assert.rejects(
    () => controller.create(makeReq() as never, "job_1", { amount: -100, etaDays: 14 }),
    BadRequestException
  );
});

test("JobBidsController: create() rejects non-integer etaDays", async () => {
  const controller = new JobBidsController({
    async listMine() { return []; },
    async list() { return []; },
    async create() { return STUB_BID; },
    async accept() { return STUB_BID; },
  } as never);

  await assert.rejects(
    () => controller.create(makeReq() as never, "job_1", { amount: 5000, etaDays: 1.5 }),
    BadRequestException
  );
});
