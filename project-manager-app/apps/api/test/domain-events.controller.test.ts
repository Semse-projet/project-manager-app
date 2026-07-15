import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { hasPermission } from "../src/common/rbac.ts";
import { DomainEventsController } from "../dist/modules/domain-events/domain-events.controller.js";

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: { "x-request-id": "req_de_1" },
    authContext: {
      tenantId: "tenant_1",
      orgId: "org_1",
      userId: "usr_admin_1",
      roles: ["OPS_ADMIN"],
    },
    query: {},
    ...overrides,
  };
}

// ── Permission declarations ───────────────────────────────────────────────────

test("domain-events controller declares correct @RequirePermissions", () => {
  const expectations: Array<[string, string]> = [
    ["catalog", "domain-events:emit"],
    ["list",    "domain-events:read"],
    ["trace",   "domain-events:read"],
    ["emit",    "domain-events:emit"],
    ["process", "domain-events:consume"],
  ];

  for (const [method, permission] of expectations) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, DomainEventsController.prototype[method]);
    assert.deepEqual(meta, [permission], `${method} should require ${permission}`);
  }
});

// ── catalog endpoint ──────────────────────────────────────────────────────────

test("domain-events controller: catalog returns list of manual-emit types", async () => {
  const catalogItems = ["rating.submitted", "job.completed", "dispute.opened"];
  const controller = new DomainEventsController({
    manualEmitCatalog: () => catalogItems,
    async list() { return []; },
    async trace() { return []; },
    async emit() { return {}; },
  } as never);

  const result = await controller.catalog(makeReq() as never);
  assert.equal(result.requestId, "req_de_1");
  assert.deepEqual(result.data, catalogItems);
});

// ── list endpoint ─────────────────────────────────────────────────────────────

test("domain-events controller: list returns events with optional filters forwarded", async () => {
  const receivedFilter: Record<string, unknown>[] = [];
  const controller = new DomainEventsController({
    manualEmitCatalog: () => [],
    async list(opts: Record<string, unknown>) {
      receivedFilter.push(opts);
      return [{ id: "evt_1", type: "rating.submitted" }];
    },
    async trace() { return []; },
    async emit() { return {}; },
  } as never);

  const result = await controller.list({
    ...makeReq({ query: { type: "rating.submitted", limit: "10" } }),
  } as never);

  assert.equal(result.data.length, 1);
  assert.equal(receivedFilter[0]?.type, "rating.submitted");
  assert.equal(receivedFilter[0]?.limit, 10);
});

test("domain-events controller: list without query uses defaults", async () => {
  const receivedFilter: Record<string, unknown>[] = [];
  const controller = new DomainEventsController({
    manualEmitCatalog: () => [],
    async list(opts: Record<string, unknown>) {
      receivedFilter.push(opts);
      return [];
    },
    async trace() { return []; },
    async emit() { return {}; },
  } as never);

  await controller.list(makeReq() as never);
  assert.equal(receivedFilter[0]?.type, undefined);
  assert.equal(receivedFilter[0]?.limit, undefined);
});

// ── trace endpoint ────────────────────────────────────────────────────────────

test("domain-events controller: trace returns events for correlationId", async () => {
  const controller = new DomainEventsController({
    manualEmitCatalog: () => [],
    async list() { return []; },
    async trace({ correlationId }: { correlationId: string }) {
      return [{ id: "evt_trace_1", correlationId }];
    },
    async emit() { return {}; },
  } as never);

  const result = await controller.trace(makeReq() as never, "corr_abc_123");
  assert.equal(result.data.length, 1);
  assert.equal((result.data[0] as Record<string, unknown>).correlationId, "corr_abc_123");
});

// ── emit endpoint ─────────────────────────────────────────────────────────────

test("domain-events controller: emit validates event schema and rejects invalid body", async () => {
  const controller = new DomainEventsController({
    manualEmitCatalog: () => [],
    async list() { return []; },
    async trace() { return []; },
    async emit() { return {}; },
  } as never);

  // Body missing required fields
  await assert.rejects(
    () => controller.emit(makeReq() as never, { type: "missing.meta" }),
    BadRequestException
  );
});

test("domain-events controller: emit routes valid event to service and returns ok", async () => {
  const emitCalls: unknown[] = [];
  const controller = new DomainEventsController({
    manualEmitCatalog: () => [],
    async list() { return []; },
    async trace() { return []; },
    async emit(event: unknown) {
      emitCalls.push(event);
      return { emitted: true, eventId: "evt_new_1" };
    },
  } as never);

  const validEvent = {
    type: "rating.submitted",
    meta: {
      tenantId: "tenant_1",
      correlationId: "rating:rat_1:submitted",
      actorId: "usr_1",
      actorType: "user",
      occurredAt: new Date().toISOString(),
      version: 1,
    },
    payload: {
      ratingId: "rat_1",
      jobId: "job_1",
      fromUserId: "usr_client_1",
      toUserId: "usr_pro_1",
      score: 5,
    },
    triggers: ["trust-match"],
  };

  const result = await controller.emit(makeReq() as never, validEvent);
  assert.equal(result.requestId, "req_de_1");
  assert.equal((result.data as Record<string, unknown>).emitted, true);
  assert.equal(emitCalls.length, 1);
});

test("domain-events controller: process requires EVENT_CONSUMER service identity", async () => {
  const controller = new DomainEventsController({} as never, {
    async process() { return { status: "completed" }; },
  } as never);

  await assert.rejects(
    () => controller.process(
      makeReq() as never,
      "6e2ac8a0-9116-47b2-8171-1bf41d420c19",
      { workerId: "worker-f1d" },
    ),
    ForbiddenException,
  );
});

test("domain-events policy: human WORKER cannot consume events; EVENT_CONSUMER can", () => {
  assert.equal(hasPermission(["WORKER"], "domain-events:consume"), false);
  assert.equal(hasPermission(["EVENT_CONSUMER"], "domain-events:consume"), true);
});

test("domain-events controller: process accepts only workerId and forwards service identity", async () => {
  const processed: Array<{ eventId: string; identity: unknown }> = [];
  const controller = new DomainEventsController({} as never, {
    async process(eventId: string, identity: unknown) {
      processed.push({ eventId, identity });
      return { eventId, status: "completed" };
    },
  } as never);
  const req = makeReq({
    authContext: {
      tenantId: "tenant_worker",
      orgId: "org_worker",
      userId: "usr_worker",
      roles: ["EVENT_CONSUMER"],
    },
  });
  const eventId = "6e2ac8a0-9116-47b2-8171-1bf41d420c19";

  const result = await controller.process(
    req as never,
    eventId,
    { workerId: "worker-f1d" },
  );
  assert.deepEqual(processed, [{
    eventId,
    identity: {
      workerId: "worker-f1d",
      serviceActorId: "usr_worker",
    },
  }]);
  assert.equal((result.data as Record<string, unknown>).status, "completed");
  await assert.rejects(
    () => controller.process(
      req as never,
      eventId,
      { workerId: "worker-f1d", payload: { unsafe: true } },
    ),
    BadRequestException,
  );
});

// ── Domain event bus ──────────────────────────────────────────────────────────

test("domain-events policy: listManualEmitTypes returns non-empty array", async () => {
  const { listManualEmitTypes } = await import("../dist/modules/domain-events/domain-events.policy.js");
  const types = listManualEmitTypes();
  assert.ok(Array.isArray(types), "should return an array");
  assert.ok(types.length > 0, "should expose at least one manual-emit type");
  assert.ok(types.every((t: unknown) => typeof t === "string"), "all items should be strings");
});
