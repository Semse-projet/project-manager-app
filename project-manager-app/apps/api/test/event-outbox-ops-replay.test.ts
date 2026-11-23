import test from "node:test";
import assert from "node:assert/strict";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  OutboxOpsService,
  OPS_EVENT_REPLAY_REQUESTED_TYPE,
} from "../dist/modules/domain-events/outbox-ops.service.js";

const ACTOR = {
  tenantId: "tenant_1",
  orgId: "org_1",
  userId: "usr_admin_1",
  requestId: "req_replay_1",
};
const EVENT_ID = "6e2ac8a0-9116-47b2-8171-1bf41d420c19";

function makeService(overrides: {
  replayResult?: unknown;
  listResult?: unknown;
  countsResult?: unknown;
  oldestPendingAgeMs?: number;
  deliveryDetail?: unknown;
} = {}) {
  const auditCalls: Record<string, unknown>[] = [];
  const enqueueCalls: Record<string, unknown>[] = [];
  const outboxRepository = {
    replay: async () => overrides.replayResult,
    list: async () => overrides.listResult ?? { items: [], nextCursor: null },
    countsByStatus: async () => overrides.countsResult ?? {},
    oldestPendingAgeMs: async () => overrides.oldestPendingAgeMs ?? 0,
    findDeliveryDetail: async () => overrides.deliveryDetail ?? null,
  };
  const auditService = {
    append: async (entry: Record<string, unknown>) => {
      auditCalls.push(entry);
    },
  };
  const queueService = {
    enqueueEvent: async (input: Record<string, unknown>) => {
      enqueueCalls.push(input);
    },
  };
  const service = new OutboxOpsService(
    outboxRepository as never,
    auditService as never,
    queueService as never,
  );
  return { service, auditCalls, enqueueCalls };
}

// ── replay: validation ────────────────────────────────────────────────────────

test("outbox ops replay: rejects empty reason before touching the repository", async () => {
  const { service } = makeService({ replayResult: { outcome: "not_found" } });

  await assert.rejects(
    () => service.replay({ actor: ACTOR, eventId: EVENT_ID, reason: "   " }),
    BadRequestException,
  );
});

// ── replay: not found / conflict ───────────────────────────────────────────────

test("outbox ops replay: 404 when event does not exist in tenant", async () => {
  const { service } = makeService({ replayResult: { outcome: "not_found" } });

  await assert.rejects(
    () => service.replay({ actor: ACTOR, eventId: EVENT_ID, reason: "retry" }),
    NotFoundException,
  );
});

test("outbox ops replay: 409 when target is not in a terminal-failed state", async () => {
  const { service } = makeService({
    replayResult: { outcome: "conflict", status: "PUBLISHED" },
  });

  await assert.rejects(
    () => service.replay({ actor: ACTOR, eventId: EVENT_ID, reason: "retry" }),
    ConflictException,
  );
});

// ── replay: success paths ──────────────────────────────────────────────────────

test("outbox ops replay: outbox-level replay writes audit with actor/reason/replayCount and does not re-enqueue", async () => {
  const { service, auditCalls, enqueueCalls } = makeService({
    replayResult: { outcome: "replayed", replayCount: 2, status: "PENDING" },
  });

  const result = await service.replay({
    actor: ACTOR,
    eventId: EVENT_ID,
    reason: "dispatcher lease kept expiring, retrying after Redis fix",
  });

  assert.deepEqual(result, {
    eventId: EVENT_ID,
    replayCount: 2,
    status: "PENDING",
    auditRef: result.auditRef,
  });
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0]?.tenantId, ACTOR.tenantId);
  assert.equal(auditCalls[0]?.actorUserId, ACTOR.userId);
  assert.equal(auditCalls[0]?.entityId, `${OPS_EVENT_REPLAY_REQUESTED_TYPE}:${EVENT_ID}`);
  const afterJson = auditCalls[0]?.afterJson as Record<string, unknown>;
  assert.equal(afterJson.type, OPS_EVENT_REPLAY_REQUESTED_TYPE);
  assert.equal(afterJson.eventId, EVENT_ID);
  assert.equal(afterJson.consumerName, null);
  assert.equal(afterJson.replayCount, 2);
  assert.match(String(afterJson.reason), /Redis fix/);
  assert.equal(enqueueCalls.length, 0);
});

test("outbox ops replay: consumer-level replay audits consumerName and re-enqueues at the new generation", async () => {
  const { service, auditCalls, enqueueCalls } = makeService({
    replayResult: { outcome: "replayed", replayCount: 3, status: "PENDING" },
  });

  const result = await service.replay({
    actor: ACTOR,
    eventId: EVENT_ID,
    consumerName: "evidence-readiness.v1",
    reason: "consumer bug fixed, safe to retry",
  });

  assert.equal(result.replayCount, 3);
  const afterJson = auditCalls[0]?.afterJson as Record<string, unknown>;
  assert.equal(afterJson.consumerName, "evidence-readiness.v1");
  assert.equal(enqueueCalls.length, 1);
  assert.deepEqual(enqueueCalls[0], { eventId: EVENT_ID, generation: 3 });
});

// ── listOutbox: validation and tenant scoping ─────────────────────────────────

test("outbox ops listOutbox: rejects an unknown status filter", async () => {
  const { service } = makeService();

  await assert.rejects(
    () => service.listOutbox({ actor: ACTOR, status: "NOT_A_STATUS" }),
    BadRequestException,
  );
});

test("outbox ops listOutbox: rejects a malformed cursor", async () => {
  const { service } = makeService();

  await assert.rejects(
    () => service.listOutbox({ actor: ACTOR, cursor: "not-base64url-json" }),
    BadRequestException,
  );
});

// ── getDeliveryDetail: not found ───────────────────────────────────────────────

test("outbox ops getDeliveryDetail: 404 when the event does not exist in the actor's tenant", async () => {
  const { service } = makeService({ deliveryDetail: null });

  await assert.rejects(
    () => service.getDeliveryDetail({ actor: ACTOR, eventId: EVENT_ID }),
    NotFoundException,
  );
});

test("outbox ops getDeliveryDetail: never exposes payloadJson even if present upstream", async () => {
  const { service } = makeService({
    deliveryDetail: {
      eventId: EVENT_ID,
      eventType: "evidence.uploaded.v1",
      status: "DEAD_LETTER",
      correlationId: "corr_1",
      causationId: null,
      entityType: "Evidence",
      entityId: "evid_1",
      attempts: 5,
      maxAttempts: 5,
      replayCount: 0,
      recordedAt: new Date("2026-07-18T00:00:00.000Z"),
      publishedAt: null,
      nextAttemptAt: new Date("2026-07-18T00:05:00.000Z"),
      lastError: "redacted failure",
      module: "evidence",
      orgId: ACTOR.orgId,
      actorType: "user",
      actorId: "usr_uploader",
      occurredAt: new Date("2026-07-17T23:55:00.000Z"),
      consumptions: [],
      // simulate a defensive check: even if a caller accidentally attaches
      // payloadJson upstream, the service's explicit serializer must drop it
      payloadJson: { secret: "should-never-leak" },
    },
  });

  const detail = await service.getDeliveryDetail({ actor: ACTOR, eventId: EVENT_ID });

  assert.equal((detail as Record<string, unknown>).payloadJson, undefined);
  assert.equal((detail as Record<string, unknown>).status, "DEAD_LETTER");
});

test("#1156: public outbox operations forward effective org scope to every repository method", async () => {
  const calls: Record<string, unknown> = {};
  const repository = {
    async list(input: unknown) { calls.list = input; return { items: [], nextCursor: null }; },
    async countsByStatus(...args: unknown[]) { calls.counts = args; return {}; },
    async oldestPendingAgeMs(...args: unknown[]) { calls.oldest = args; return 0; },
    async findDeliveryDetail(input: unknown) { calls.detail = input; return null; },
    async replay(input: unknown) { calls.replay = input; return { outcome: "not_found" }; },
  };
  const service = new OutboxOpsService(repository as never, {} as never, {} as never);
  await service.listOutbox({ actor: ACTOR });
  assert.equal((calls.list as any).orgId, ACTOR.orgId);
  assert.deepEqual(calls.counts, [ACTOR.tenantId, ACTOR.orgId]);
  assert.equal((calls.oldest as any[])[0], ACTOR.tenantId);
  assert.ok((calls.oldest as any[])[1] instanceof Date);
  assert.equal((calls.oldest as any[])[2], ACTOR.orgId);
  await assert.rejects(() => service.getDeliveryDetail({ actor: ACTOR, eventId: EVENT_ID }), NotFoundException);
  assert.equal((calls.detail as any).orgId, ACTOR.orgId);
  await assert.rejects(() => service.replay({ actor: ACTOR, eventId: EVENT_ID, reason: "qa" }), NotFoundException);
  assert.equal((calls.replay as any).orgId, ACTOR.orgId);
});


test("#1156: outbox operations fail closed with missing org identity", async () => {
  const { service } = makeService({ replayResult: { outcome: "replayed", replayCount: 1, status: "PENDING" } });
  const invalid = { ...ACTOR, orgId: "" };
  for (const fn of [
    () => service.listOutbox({ actor: invalid }),
    () => service.getDeliveryDetail({ actor: invalid, eventId: EVENT_ID }),
    () => service.replay({ actor: invalid, eventId: EVENT_ID, reason: "test" }),
  ]) {
    await assert.rejects(fn, (e: any) => e?.getStatus?.() === 403);
  }
});

test("#1156: outbox operations fail closed when the session org is the system sentinel", async () => {
  const { service } = makeService({ replayResult: { outcome: "replayed", replayCount: 1, status: "PENDING" } });
  const invalid = { ...ACTOR, orgId: "system" };
  for (const fn of [
    () => service.listOutbox({ actor: invalid }),
    () => service.getDeliveryDetail({ actor: invalid, eventId: EVENT_ID }),
    () => service.replay({ actor: invalid, eventId: EVENT_ID, reason: "test" }),
  ]) {
    await assert.rejects(fn, (e: any) => e?.getStatus?.() === 403);
  }
});
