import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { OperationalIntelligenceController } from "../dist/modules/operational-intelligence/operational-intelligence.controller.js";

function makeReq(overrides: Record<string, unknown> = {}) {
  // parseHeaderRequestContext(req) in this controller passes the whole req
  // so identity headers must be top-level on the req object
  return {
    headers: { "x-request-id": "req_oi_1" },
    "x-request-id": "req_oi_1",
    "x-tenant-id": "tenant_1",
    "x-org-id": "org_1",
    "x-user-id": "usr_admin_1",
    "x-roles": "OPS_ADMIN",
    ...overrides,
  };
}

const STUB_SIGNAL = {
  id: "sig_1",
  tenantId: "tenant_1",
  type: "EVIDENCE_GAP",
  severity: "high",
  title: "Missing evidence for Milestone #2",
  message: "3 photos required, 0 uploaded.",
  status: "active",
  sourceAgent: "buildops-intelligence",
  createdAt: new Date().toISOString(),
};

const STUB_RUN = {
  id: "run_1",
  tenantId: "tenant_1",
  agentType: "buildops-intelligence",
  status: "completed",
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
};

// ── Permission declarations ───────────────────────────────────────────────────

test("operational-intelligence controller declares correct @RequirePermissions", () => {
  const expectations: Array<[string, string]> = [
    ["listSignals",      "ops:dashboard:read"],
    ["acknowledgeSignal","ops:dashboard:write"],
    ["resolveSignal",    "ops:dashboard:write"],
    ["dismissSignal",    "ops:dashboard:write"],
    ["listRuns",         "ops:dashboard:read"],
    ["seedTestSignals",  "ops:dashboard:write"],
    ["getBrief",         "ops:dashboard:read"],
  ];

  for (const [method, permission] of expectations) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, OperationalIntelligenceController.prototype[method]);
    assert.deepEqual(meta, [permission], `${method} should require ${permission}`);
  }
});

// ── listSignals ───────────────────────────────────────────────────────────────

test("operational-intelligence controller: listSignals routes with filters", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new OperationalIntelligenceController(
    {
      async list(opts: Record<string, unknown>) {
        calls.push(opts);
        return [STUB_SIGNAL];
      },
      async acknowledge() {},
      async resolve() {},
      async dismiss() {},
      async upsertSignal() { return { created: true }; },
    } as never,
    {
      async listRecent() { return []; },
    } as never,
    {
      async generateBrief() { return { summary: "ok" }; },
    } as never,
  );

  const result = await controller.listSignals(makeReq() as never, "active", "high", "EVIDENCE_GAP", "job_1", undefined, undefined, "20");
  assert.equal(result.requestId, "req_oi_1");
  assert.equal(result.data.length, 1);
  assert.equal(calls[0]?.status, "active");
  assert.equal(calls[0]?.severity, "high");
  assert.equal(calls[0]?.type, "EVIDENCE_GAP");
  assert.equal(calls[0]?.jobId, "job_1");
  assert.equal(calls[0]?.limit, 20);
});

test("operational-intelligence controller: listSignals uses default limit 50 when not provided", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new OperationalIntelligenceController(
    {
      async list(opts: Record<string, unknown>) {
        calls.push(opts);
        return [];
      },
      async acknowledge() {},
      async resolve() {},
      async dismiss() {},
      async upsertSignal() { return { created: false }; },
    } as never,
    { async listRecent() { return []; } } as never,
    { async generateBrief() { return {}; } } as never,
  );

  await controller.listSignals(makeReq() as never);
  assert.equal(calls[0]?.limit, 50, "default limit should be 50");
});

// ── acknowledgeSignal ─────────────────────────────────────────────────────────

test("operational-intelligence controller: acknowledgeSignal returns acknowledged:true", async () => {
  const ackCalls: string[] = [];
  const controller = new OperationalIntelligenceController(
    {
      async list() { return []; },
      async acknowledge(id: string) { ackCalls.push(id); },
      async resolve() {},
      async dismiss() {},
      async upsertSignal() { return { created: false }; },
    } as never,
    { async listRecent() { return []; } } as never,
    { async generateBrief() { return {}; } } as never,
  );

  const result = await controller.acknowledgeSignal(makeReq() as never, "sig_abc");
  assert.equal(result.data.acknowledged, true);
  assert.equal(ackCalls[0], "sig_abc");
});

// ── resolveSignal ─────────────────────────────────────────────────────────────

test("operational-intelligence controller: resolveSignal returns resolved:true", async () => {
  const resolveCalls: string[] = [];
  const controller = new OperationalIntelligenceController(
    {
      async list() { return []; },
      async acknowledge() {},
      async resolve(id: string) { resolveCalls.push(id); },
      async dismiss() {},
      async upsertSignal() { return { created: false }; },
    } as never,
    { async listRecent() { return []; } } as never,
    { async generateBrief() { return {}; } } as never,
  );

  const result = await controller.resolveSignal(makeReq() as never, "sig_xyz");
  assert.equal(result.data.resolved, true);
  assert.equal(resolveCalls[0], "sig_xyz");
});

// ── dismissSignal ─────────────────────────────────────────────────────────────

test("operational-intelligence controller: dismissSignal returns dismissed:true", async () => {
  const dismissCalls: string[] = [];
  const controller = new OperationalIntelligenceController(
    {
      async list() { return []; },
      async acknowledge() {},
      async resolve() {},
      async dismiss(id: string) { dismissCalls.push(id); },
      async upsertSignal() { return { created: false }; },
    } as never,
    { async listRecent() { return []; } } as never,
    { async generateBrief() { return {}; } } as never,
  );

  const result = await controller.dismissSignal(makeReq() as never, "sig_to_dismiss");
  assert.equal(result.data.dismissed, true);
  assert.equal(dismissCalls[0], "sig_to_dismiss");
});

// ── listRuns ──────────────────────────────────────────────────────────────────

test("operational-intelligence controller: listRuns with default limit 20", async () => {
  const calls: Array<[string, number]> = [];
  const controller = new OperationalIntelligenceController(
    {
      async list() { return []; },
      async acknowledge() {},
      async resolve() {},
      async dismiss() {},
      async upsertSignal() { return { created: false }; },
    } as never,
    {
      async listRecent(tenantId: string, limit: number) {
        calls.push([tenantId, limit]);
        return [STUB_RUN];
      },
    } as never,
    { async generateBrief() { return {}; } } as never,
  );

  const result = await controller.listRuns(makeReq() as never);
  assert.equal(result.data.length, 1);
  assert.equal(calls[0]?.[0], "tenant_1");
  assert.equal(calls[0]?.[1], 20, "default limit should be 20");
});

test("operational-intelligence controller: listRuns accepts custom limit", async () => {
  const calls: number[] = [];
  const controller = new OperationalIntelligenceController(
    {
      async list() { return []; },
      async acknowledge() {},
      async resolve() {},
      async dismiss() {},
      async upsertSignal() { return { created: false }; },
    } as never,
    {
      async listRecent(_tenantId: string, limit: number) {
        calls.push(limit);
        return [];
      },
    } as never,
    { async generateBrief() { return {}; } } as never,
  );

  await controller.listRuns(makeReq() as never, "5");
  assert.equal(calls[0], 5);
});

// ── getBrief ──────────────────────────────────────────────────────────────────

test("operational-intelligence controller: getBrief routes to prometeo-brief service", async () => {
  const controller = new OperationalIntelligenceController(
    {
      async list() { return []; },
      async acknowledge() {},
      async resolve() {},
      async dismiss() {},
      async upsertSignal() { return { created: false }; },
    } as never,
    { async listRecent() { return []; } } as never,
    {
      async generateBrief(tenantId: string, buildOpsProjectId?: string) {
        return {
          tenantId,
          buildOpsProjectId: buildOpsProjectId ?? null,
          summary: "3 active signals, 1 dispute risk",
          signalCount: 3,
          generatedAt: new Date().toISOString(),
        };
      },
    } as never,
  );

  const result = await controller.getBrief(makeReq() as never, "bop_1");
  assert.equal(result.data.tenantId, "tenant_1");
  assert.equal(result.data.buildOpsProjectId, "bop_1");
  assert.ok(typeof result.data.summary === "string");
});

// ── seedTestSignals ───────────────────────────────────────────────────────────

test("operational-intelligence controller: seedTestSignals creates 3 test signals", async () => {
  const created: unknown[] = [];
  const controller = new OperationalIntelligenceController(
    {
      async list() { return []; },
      async acknowledge() {},
      async resolve() {},
      async dismiss() {},
      async upsertSignal(data: unknown) {
        created.push(data);
        return { created: true };
      },
    } as never,
    { async listRecent() { return []; } } as never,
    { async generateBrief() { return {}; } } as never,
  );

  const result = await controller.seedTestSignals(makeReq() as never);
  assert.equal(result.data.total, 3);
  assert.equal(result.data.seeded, 3);
  assert.equal(created.length, 3);
});
