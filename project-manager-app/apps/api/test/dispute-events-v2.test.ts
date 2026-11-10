import test from "node:test";
import assert from "node:assert/strict";

import { DISPUTE_OPENED_V1_SCHEMA_REF, disputeOpenedV1EventSchema, semseEventSchema } from "@semse/schemas";
import { MetricsService } from "../dist/infrastructure/observability/metrics.service.js";
import { DomainEventBus } from "../dist/modules/domain-events/domain-event-bus.service.js";
import { DomainEventConsumerService } from "../dist/modules/domain-events/domain-event-consumer.service.js";
import {
  DisputeEffectsConsumer,
  DisputeEffectsTerminalError,
} from "../dist/modules/domain-events/dispute-effects.consumer.js";
import {
  buildDisputeV2Event,
  buildLegacyDisputeEvent,
  DISPUTE_EFFECTS_CONSUMER,
  resolveDisputeEventsV2Mode,
} from "../dist/modules/disputes/dispute-events-v2.js";
import { DisputesRepository } from "../dist/modules/disputes/disputes.repository.js";
import { DisputesService } from "../dist/modules/disputes/disputes.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Event backbone F2, slice 1 — disputas (spec platform.event-backbone-f2-legacy-producers, D1–D4).
// ─────────────────────────────────────────────────────────────────────────────

const TENANT = "tenant_1";
const ORG = "org_ops";
const OPS = { tenantId: TENANT, orgId: ORG, userId: "user_ops", roles: ["OPS_ADMIN"], requestId: "req_1" };

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>) {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return fn().finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

const OFF = { SEMSE_DISPUTE_EVENTS_V2_MODE: undefined, SEMSE_DISPUTE_EVENTS_V2_TENANT_IDS: undefined };
const mode = (m: "shadow" | "on") => ({ SEMSE_DISPUTE_EVENTS_V2_MODE: m, SEMSE_DISPUTE_EVENTS_V2_TENANT_IDS: TENANT });

// ── D1: flag por tenant ──────────────────────────────────────────────────────

test("D1: el modo es off por defecto, ante valores desconocidos y para tenants fuera de la lista", () => {
  assert.equal(resolveDisputeEventsV2Mode(TENANT, {}), "off");
  assert.equal(resolveDisputeEventsV2Mode(TENANT, { SEMSE_DISPUTE_EVENTS_V2_MODE: "enforce", SEMSE_DISPUTE_EVENTS_V2_TENANT_IDS: "*" }), "off");
  assert.equal(resolveDisputeEventsV2Mode(TENANT, { SEMSE_DISPUTE_EVENTS_V2_MODE: "on" }), "off");
  assert.equal(resolveDisputeEventsV2Mode(TENANT, { SEMSE_DISPUTE_EVENTS_V2_MODE: "on", SEMSE_DISPUTE_EVENTS_V2_TENANT_IDS: "other" }), "off");
  assert.equal(resolveDisputeEventsV2Mode(TENANT, { SEMSE_DISPUTE_EVENTS_V2_MODE: " Shadow ", SEMSE_DISPUTE_EVENTS_V2_TENANT_IDS: `a, ${TENANT}` }), "shadow");
  assert.equal(resolveDisputeEventsV2Mode(TENANT, { SEMSE_DISPUTE_EVENTS_V2_MODE: "on", SEMSE_DISPUTE_EVENTS_V2_TENANT_IDS: "*" }), "on");
});

test("evento v2: solo referencias, modo de efectos sellado y entityId ligado al disputeId", () => {
  const event = buildDisputeV2Event({
    eventType: "dispute.opened.v1",
    tenantId: TENANT,
    orgId: ORG,
    actorUserId: "user_client",
    requestId: "req_1",
    effectsMode: "shadow",
    disputeId: "dispute_1",
    payload: { disputeId: "dispute_1", projectId: "project_1", jobId: "job_1", raisedById: "user_client" },
  });
  assert.equal(event.schemaRef, DISPUTE_OPENED_V1_SCHEMA_REF);
  assert.equal(event.correlationId, "dispute:dispute_1:opened");
  assert.equal(event.idempotencyKey, "dispute.opened.v1:dispute_1");
  assert.deepEqual(event.metadata, { source: "disputes.service", effectsMode: "shadow", requestId: "req_1" });
  assert.equal(JSON.stringify(event).includes("reason"), false);

  assert.throws(() => buildDisputeV2Event({
    eventType: "dispute.opened.v1", tenantId: TENANT, orgId: ORG, actorUserId: "u", requestId: "r",
    effectsMode: "on", disputeId: "dispute_1",
    payload: { disputeId: "dispute_1", projectId: "p", jobId: "j", raisedById: "u", reason: "texto" },
  }), "el payload strict rechaza el texto libre");
  assert.equal(disputeOpenedV1EventSchema.safeParse({ ...event, entityId: "dispute_2" }).success, false);

  const a = buildDisputeV2Event({
    eventType: "dispute.assigned.v1", tenantId: TENANT, orgId: ORG, actorUserId: "u", requestId: "r",
    effectsMode: "on", disputeId: "dispute_1",
    payload: { disputeId: "dispute_1", projectId: "p", jobId: "j", assigneeUserId: "ops_2" },
  });
  const b = buildDisputeV2Event({
    eventType: "dispute.assigned.v1", tenantId: TENANT, orgId: ORG, actorUserId: "u", requestId: "r",
    effectsMode: "on", disputeId: "dispute_1",
    payload: { disputeId: "dispute_1", projectId: "p", jobId: "j", assigneeUserId: "ops_3" },
  });
  assert.notEqual(a.idempotencyKey, b.idempotencyKey, "una reasignación es un hecho nuevo");
});

// ── Atomicidad en el repositorio (F1 §8) ─────────────────────────────────────

function makeRepositoryHarness() {
  const committed = new Map<string, Record<string, unknown>>([[
    "dispute_1",
    {
      id: "dispute_1", tenantId: TENANT, projectId: "project_1", reason: "Trabajo incompleto", status: "OPEN",
      raisedById: "user_client", assigneeUserId: null, resolvedById: null, resolution: null, resolutionType: null,
      evidenceBundleIds: [],
      project: { jobId: "job_1", assignedProOrgId: "org_pro", job: { clientOrgId: "org_client" } },
    },
  ]]);
  let transactions = 0;
  const outbox: unknown[] = [];
  const updateOn = (store: Map<string, Record<string, unknown>>) => ({
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const row = { ...store.get(where.id)!, ...data };
      store.set(where.id, row);
      return row;
    },
  });
  const prisma = {
    dispute: {
      async findFirst({ where }: { where: { id: string } }) {
        const row = committed.get(where.id);
        return row ? { ...row } : null;
      },
      ...updateOn(committed),
    },
    async $transaction(callback: (tx: unknown) => Promise<unknown>) {
      transactions += 1;
      const staged = new Map([...committed].map(([k, v]) => [k, { ...v }]));
      const stagedOutbox: unknown[] = [];
      const tx = {
        dispute: updateOn(staged),
        domainOutboxEvent: { async create({ data }: { data: unknown }) { stagedOutbox.push(data); } },
      };
      const result = await callback(tx);
      for (const [k, v] of staged) committed.set(k, v);
      outbox.push(...stagedOutbox);
      return result;
    },
  };
  const repository = new DisputesRepository(
    prisma as never,
    { async ensureActorContext() {} } as never,
    { async resolveDisputeScope() { return { clientOrgId: "org_client", assignedProOrgId: "org_pro" }; } } as never,
  );
  return { repository, committed, outbox, transactionCount: () => transactions };
}

test("atomicidad: si el hook (insert en el outbox) falla, el cambio de estado se revierte", async () => {
  const h = makeRepositoryHarness();
  await assert.rejects(
    h.repository.assign({ ...OPS, disputeId: "dispute_1", assigneeUserId: "ops_2" }, async () => {
      throw new Error("outbox insert failed");
    }),
    /outbox insert failed/,
  );
  assert.equal(h.committed.get("dispute_1")!.status, "OPEN");
  assert.equal(h.committed.get("dispute_1")!.assigneeUserId, null);
});

test("atomicidad: con hook, escritura y hook comparten transacción y el hook recibe projectId/jobId", async () => {
  const h = makeRepositoryHarness();
  const seen: Array<Record<string, unknown>> = [];
  const record = await h.repository.assign({ ...OPS, disputeId: "dispute_1", assigneeUserId: "ops_2" }, async (tx: any, written: any) => {
    seen.push(written);
    await tx.domainOutboxEvent.create({ data: { eventType: "dispute.assigned.v1" } });
  });
  assert.equal(record.status, "assigned");
  assert.equal(h.transactionCount(), 1);
  assert.equal(seen[0]!.projectId, "project_1");
  assert.equal(seen[0]!.jobId, "job_1");
  assert.equal((seen[0]!.record as { assigneeUserId: string }).assigneeUserId, "ops_2");
  assert.deepEqual(h.outbox, [{ eventType: "dispute.assigned.v1" }]);
});

test("off: sin hook el repositorio escribe como antes de F2 (sin transacción nueva)", async () => {
  const h = makeRepositoryHarness();
  const record = await h.repository.markUnderReview({ ...OPS, disputeId: "dispute_1" }).catch((e: Error) => e);
  assert.ok(record instanceof Error, "OPEN → UNDER_REVIEW sigue rechazado");
  await h.repository.assign({ ...OPS, disputeId: "dispute_1", assigneeUserId: "ops_2" });
  await h.repository.markUnderReview({ ...OPS, disputeId: "dispute_1" });
  assert.equal(h.transactionCount(), 0);
  assert.equal(h.committed.get("dispute_1")!.status, "UNDER_REVIEW");
});

// ── Servicio: modos off / shadow / on ────────────────────────────────────────

const DISPUTE = {
  id: "dispute_1", tenantId: TENANT, projectId: "project_1", reason: "Trabajo incompleto", status: "open",
  evidenceBundleIds: ["ev_1", "ev_2"],
};

function makeServiceHarness(opts: { withOutbox?: boolean } = {}) {
  const emits: Array<{ event: any; options: unknown }> = [];
  const outbox: any[] = [];
  const hooks: unknown[] = [];
  const written = { projectId: "project_1", jobId: "job_1" };
  const record = (patch: Record<string, unknown>) => ({ ...DISPUTE, ...patch });
  const run = async (hook: any, rec: any) => {
    hooks.push(hook);
    if (hook) await hook({}, { record: rec, ...written });
    return rec;
  };
  const repository = {
    async create(_i: unknown, hook: unknown) { return run(hook, record({})); },
    async assign(_i: unknown, hook: unknown) { return run(hook, record({ status: "assigned", assigneeUserId: "ops_2" })); },
    async submitEvidence(_i: unknown, hook: unknown) { return run(hook, record({ assigneeUserId: "ops_2" })); },
    async markUnderReview(_i: unknown, hook: unknown) { return run(hook, record({ status: "under_review", assigneeUserId: "ops_2" })); },
    async resolve(_i: unknown, hook: unknown) {
      return run(hook, record({ status: "resolved", resolution: "Reembolso parcial", resolutionType: "partial_50_50" }));
    },
    async getEventContext() {
      return { disputeId: "dispute_1", jobId: "job_1", projectId: "project_1", raisedById: "user_client", reason: "Trabajo incompleto" };
    },
  };
  const service = new DisputesService(
    repository as never,
    { async append() {} } as never,
    { async emit(event: unknown, _ctx: unknown, options?: unknown) { emits.push({ event, options }); return []; } } as never,
    { async append() {} } as never,
    undefined,
    undefined,
    opts.withOutbox === false ? undefined : ({ async create(_tx: unknown, event: unknown) { outbox.push(event); } } as never),
  );
  return { service, emits, outbox, hooks };
}

async function runAllWrites(service: any) {
  await service.create({ ...OPS, userId: "user_client", roles: [], projectId: "project_1", reason: "Trabajo incompleto" });
  await service.assign({ ...OPS, disputeId: "dispute_1", assigneeUserId: "ops_2" });
  await service.submitEvidence({ ...OPS, userId: "user_client", roles: [], disputeId: "dispute_1", evidenceIds: ["ev_2"] });
  await service.markUnderReview({ ...OPS, disputeId: "dispute_1" });
  await service.resolve({ ...OPS, disputeId: "dispute_1", resolution: "Reembolso parcial", resolutionType: "partial_50_50" });
}

test("off: ningún hook, ningún evento v2 y el bus legacy conserva todos sus efectos", async () => {
  await withEnv(OFF, async () => {
    const h = makeServiceHarness();
    await runAllWrites(h.service);
    assert.deepEqual(h.hooks, [undefined, undefined, undefined, undefined, undefined]);
    assert.equal(h.outbox.length, 0);
    assert.equal(h.emits.length, 5);
    assert.ok(h.emits.every((e) => e.options === undefined));
  });
});

test("sin OutboxRepository inyectado, shadow/on degradan a off (el legacy no pierde efectos)", async () => {
  await withEnv(mode("on"), async () => {
    const h = makeServiceHarness({ withOutbox: false });
    await runAllWrites(h.service);
    assert.ok(h.hooks.every((hook) => hook === undefined));
    assert.ok(h.emits.every((e) => e.options === undefined));
  });
});

test("shadow: evento v2 en el outbox para las 5 escrituras y el bus legacy sigue completo", async () => {
  await withEnv(mode("shadow"), async () => {
    const h = makeServiceHarness();
    await runAllWrites(h.service);
    assert.deepEqual(h.outbox.map((e) => e.eventType), [
      "dispute.opened.v1", "dispute.assigned.v1", "dispute.evidence_submitted.v1",
      "dispute.under_review.v1", "dispute.resolved.v1",
    ]);
    assert.ok(h.outbox.every((e) => e.metadata.effectsMode === "shadow"));
    assert.ok(h.emits.every((e) => e.options === undefined));
  });
});

test("on (D3): el emit legacy pasa a solo auditoría", async () => {
  await withEnv(mode("on"), async () => {
    const h = makeServiceHarness();
    await runAllWrites(h.service);
    assert.ok(h.outbox.every((e) => e.metadata.effectsMode === "on"));
    assert.ok(h.emits.every((e) => (e.options as { effects: string }).effects === "audit-only"));
  });
});

test("paridad: el evento legacy reconstruido por el consumidor es idéntico al que emite el servicio (5 tipos)", async () => {
  await withEnv(mode("shadow"), async () => {
    const h = makeServiceHarness();
    await runAllWrites(h.service);
    const snapshot = { reason: "Trabajo incompleto", raisedById: "user_client", resolution: "Reembolso parcial" };
    const strip = (e: any) => ({ ...e, meta: { ...e.meta, occurredAt: "<t>" } });
    for (let i = 0; i < 5; i++) {
      const emitted = strip(semseEventSchema.parse(h.emits[i]!.event));
      const rebuilt = strip(semseEventSchema.parse(buildLegacyDisputeEvent(h.outbox[i], snapshot)));
      assert.deepEqual(rebuilt, emitted, `paridad ${h.outbox[i].eventType}`);
    }
  });
});

// ── Bus legacy: audit-only ───────────────────────────────────────────────────

test("bus audit-only: registra AuditLog e invalida, pero no notifica ni dispara agentes", async () => {
  const calls: string[] = [];
  const bus = new DomainEventBus(
    { async append(entry: any) { calls.push(`audit:${entry.afterJson.effects ?? "all"}`); } } as never,
    { async route() { calls.push("route"); return []; } } as never,
    { async handleEvent() { calls.push("notify"); } } as never,
    { invalidateScope() { calls.push("invalidate"); } } as never,
  );
  const event = {
    type: "dispute.assigned",
    meta: { tenantId: TENANT, correlationId: "dispute:dispute_1:assigned", actorId: "u", actorType: "user", occurredAt: new Date().toISOString(), version: 1 },
    payload: { disputeId: "dispute_1", assigneeId: "ops_2", jobId: "job_1", projectId: "project_1" },
    triggers: ["notification", "audit"],
  };
  const ctx = { tenantId: TENANT, orgId: ORG, userId: "u", requestId: "r" };
  assert.deepEqual(await bus.emit(event, ctx, { effects: "audit-only" }), []);
  assert.deepEqual(calls, ["audit:audit-only", "invalidate"]);
  calls.length = 0;
  await bus.emit(event, ctx);
  assert.deepEqual(calls.sort(), ["audit:all", "invalidate", "notify", "route"]);
});

// ── Consumidor dispute-effects.v1 ────────────────────────────────────────────

function storedFrom(event: any) {
  return {
    eventId: event.eventId, eventType: event.eventType, version: event.version, envelopeVersion: event.envelopeVersion,
    occurredAt: new Date(event.occurredAt), recordedAt: new Date(event.recordedAt),
    tenantId: event.tenantId, orgId: event.orgId, module: event.module, entityType: event.entityType,
    entityId: event.entityId, actorType: event.actor.type, actorId: event.actor.id,
    correlationId: event.correlationId, causationId: null, idempotencyKey: event.idempotencyKey,
    schemaRef: event.schemaRef, payloadJson: event.payload, metadataJson: event.metadata ?? null,
    traceContextJson: null,
  };
}

function openedEvent(effectsMode: "shadow" | "on") {
  return buildDisputeV2Event({
    eventType: "dispute.opened.v1", tenantId: TENANT, orgId: ORG, actorUserId: "user_client", requestId: "req_9",
    effectsMode, disputeId: "dispute_1",
    payload: { disputeId: "dispute_1", projectId: "project_1", jobId: "job_1", raisedById: "user_client" },
  });
}

function makeConsumerHarness(opts: { disputeTenant?: string } = {}) {
  let receipt: Record<string, any> | undefined;
  const calls: string[] = [];
  const audit: any[] = [];
  const disputeQueries: any[] = [];
  const tx = {
    async $executeRaw() { receipt ??= { id: "rc_1", status: "PENDING", attempts: 0, maxAttempts: 5, resultJson: null }; return 1; },
    async $queryRaw() { return receipt ? [receipt] : []; },
    domainEventConsumption: { async update({ data }: any) { Object.assign(receipt!, data); return receipt; } },
    auditLog: { async create({ data }: any) { audit.push(data); } },
  };
  const prisma = {
    domainEventConsumption: {
      async findUnique() { return receipt ? { status: receipt.status, resultJson: receipt.resultJson } : null; },
    },
    dispute: {
      async findFirst({ where }: any) {
        disputeQueries.push(where);
        if (where.tenantId !== (opts.disputeTenant ?? TENANT)) return null;
        return { reason: "Trabajo incompleto", raisedById: "user_client", resolution: null };
      },
    },
    async $transaction(cb: (t: typeof tx) => Promise<unknown>) { return cb(tx); },
  };
  const notifications = { async handleEvent(input: any) { calls.push(`notify:${input.eventType}:${input.payload.reason}`); } };
  const router = {
    async route(event: any, ctx: any) { calls.push(`route:${event.type}:${event.triggers.join("+")}:${ctx.requestId}`); return []; },
  };
  const consumer = new DisputeEffectsConsumer(prisma as never, notifications as never, router as never);
  return { consumer, prisma, calls, audit, disputeQueries, receipt: () => receipt };
}

test("consumidor shadow: no ejecuta efectos y deja en el recibo lo que habría producido", async () => {
  const h = makeConsumerHarness();
  const result = await h.consumer.consume(storedFrom(openedEvent("shadow")) as never);
  assert.deepEqual(h.calls, []);
  assert.equal(result.effect, "no_op");
  assert.equal(result.effectsMode, "shadow");
  assert.equal(result.legacyEventType, "dispute.opened");
  assert.deepEqual(result.triggers, ["dispute", "risk", "notification", "audit"]);
  assert.deepEqual(result.notifications, [{ userId: "user_client", type: "dispute_opened_confirmation" }]);
  assert.equal(h.receipt()!.status, "COMPLETED");
  assert.equal(h.audit[0].action, "domain_event.consumer.dispute_effects.no_op");
  assert.deepEqual(h.disputeQueries[0], { id: "dispute_1", tenantId: TENANT });
});

test("consumidor on: dispara agentes antes que notificaciones, con el texto releído, y no repite en duplicado", async () => {
  const h = makeConsumerHarness();
  const stored = storedFrom(openedEvent("on"));
  const result = await h.consumer.consume(stored as never);
  assert.deepEqual(h.calls, [
    "route:dispute.opened:dispute+risk+notification+audit:req_9",
    "notify:dispute.opened:Trabajo incompleto",
  ]);
  assert.equal(result.effect, "updated");
  const again = await h.consumer.consume(stored as never);
  assert.equal(again.duplicate, true);
  assert.equal(h.calls.length, 2, "un recibo COMPLETED no vuelve a ejecutar efectos");
});

test("consumidor: disputa de otro tenant ⇒ error terminal, sin efectos", async () => {
  const h = makeConsumerHarness({ disputeTenant: "tenant_other" });
  await assert.rejects(h.consumer.consume(storedFrom(openedEvent("on")) as never), DisputeEffectsTerminalError);
  assert.deepEqual(h.calls, []);
});

test("registro: dispute.opened.v1 se enruta a dispute-effects.v1 y un error terminal va a dead letter", async () => {
  await withEnv({
    SEMSE_EVENT_CONSUMERS_ENABLED: "true",
    SEMSE_EVENT_CONSUMER_ALLOWLIST: DISPUTE_EFFECTS_CONSUMER,
    SEMSE_EVENT_TYPE_ALLOWLIST: "dispute.opened.v1",
  }, async () => {
    const stored = storedFrom(openedEvent("on"));
    let failureReceipt: Record<string, any> | undefined;
    const prisma = {
      domainOutboxEvent: { async findUnique() { return stored; } },
      async $transaction(cb: (tx: unknown) => Promise<unknown>) {
        return cb({
          async $executeRaw() { failureReceipt ??= { id: "rc", status: "PENDING", attempts: 0, maxAttempts: 5 }; return 1; },
          async $queryRaw() { return [failureReceipt]; },
          domainEventConsumption: { async update({ data }: any) { Object.assign(failureReceipt!, data); } },
        });
      },
    };
    const consumed: string[] = [];
    const service = new DomainEventConsumerService(
      prisma as never, new MetricsService(), undefined, undefined, undefined, undefined,
      { async consume(e: any) { consumed.push(e.eventType); throw new DisputeEffectsTerminalError("Dispute not found for the event tenant"); } } as never,
    );
    await assert.rejects(service.process(stored.eventId), (error: any) => error.getStatus?.() === 422);
    assert.deepEqual(consumed, ["dispute.opened.v1"]);
    assert.equal(failureReceipt!.status, "DEAD_LETTER");
  });
});
