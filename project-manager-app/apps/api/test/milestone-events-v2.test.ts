import test from "node:test";
import assert from "node:assert/strict";

import { milestoneApprovedV1EventSchema, semseEventSchema } from "@semse/schemas";
import { MetricsService } from "../dist/infrastructure/observability/metrics.service.js";
import { DomainEventConsumerService } from "../dist/modules/domain-events/domain-event-consumer.service.js";
import {
  MilestoneEffectsConsumer,
  MilestoneEffectsTerminalError,
} from "../dist/modules/domain-events/milestone-effects.consumer.js";
import {
  buildLegacyMilestoneEvents,
  buildMilestoneV2Event,
  hasStampedEffectsMode,
  MILESTONE_EFFECTS_CONSUMER,
  resolveMilestoneEventsV2Mode,
} from "../dist/modules/milestones/milestone-events-v2.js";
import { MilestonesRepository } from "../dist/modules/milestones/milestones.repository.js";
import { MilestonesService } from "../dist/modules/milestones/milestones.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Event backbone F2, slice 2b — milestones (plan event-backbone-f2-milestones.plan.md §2b, D1–D5).
// ─────────────────────────────────────────────────────────────────────────────

const TENANT = "tenant_1";
const CLIENT = { tenantId: TENANT, orgId: "org_client", userId: "user_client", roles: ["CLIENT"], requestId: "req_1" };
const PRO = { ...CLIENT, orgId: "org_pro", userId: "user_pro", roles: ["PRO"] };

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
const OFF = { SEMSE_MILESTONE_EVENTS_V2_MODE: undefined, SEMSE_MILESTONE_EVENTS_V2_TENANT_IDS: undefined };
const mode = (m: "shadow" | "on") => ({ SEMSE_MILESTONE_EVENTS_V2_MODE: m, SEMSE_MILESTONE_EVENTS_V2_TENANT_IDS: TENANT });

// ── Flag y envelope ──────────────────────────────────────────────────────────

test("D1: off por defecto, ante valores desconocidos y fuera de la lista de tenants", () => {
  assert.equal(resolveMilestoneEventsV2Mode(TENANT, {}), "off");
  assert.equal(resolveMilestoneEventsV2Mode(TENANT, { SEMSE_MILESTONE_EVENTS_V2_MODE: "enforce", SEMSE_MILESTONE_EVENTS_V2_TENANT_IDS: "*" }), "off");
  assert.equal(resolveMilestoneEventsV2Mode(TENANT, { SEMSE_MILESTONE_EVENTS_V2_MODE: "on", SEMSE_MILESTONE_EVENTS_V2_TENANT_IDS: "other" }), "off");
  assert.equal(resolveMilestoneEventsV2Mode(TENANT, { SEMSE_MILESTONE_EVENTS_V2_MODE: "shadow", SEMSE_MILESTONE_EVENTS_V2_TENANT_IDS: `x,${TENANT}` }), "shadow");
  assert.equal(hasStampedEffectsMode({ effectsMode: "on" }), true);
  assert.equal(hasStampedEffectsMode(null), false, "los milestone.*.v1 best-effort de SAT-007 no llevan modo");
  assert.equal(hasStampedEffectsMode({ effectsMode: "off" }), false);
});

test("D4: approved/rejected.v1 conservan correlación y payload SAT-007; los nuevos usan la correlación legacy", () => {
  const approved = buildMilestoneV2Event({
    eventType: "milestone.approved.v1", tenantId: TENANT, orgId: "org_client", actorUserId: "user_client",
    requestId: "req_1", effectsMode: "shadow", milestoneId: "ms_1",
    payload: { milestoneId: "ms_1", projectId: "p_1", jobId: "j_1", reviewerId: "user_client", amount: 500 },
  });
  assert.equal(milestoneApprovedV1EventSchema.safeParse(approved).success, true, "satellite-webhooks.v1 lo sigue aceptando");
  assert.equal(approved.correlationId, "milestone.approved.v1:ms_1");
  assert.deepEqual(approved.metadata, { source: "milestones.service", effectsMode: "shadow", requestId: "req_1" });

  const submitted = buildMilestoneV2Event({
    eventType: "milestone.submitted.v1", tenantId: TENANT, orgId: "org_pro", actorUserId: "user_pro",
    requestId: "req_2", effectsMode: "on", milestoneId: "ms_1",
    payload: { milestoneId: "ms_1", projectId: "p_1", jobId: "j_1", professionalId: "user_pro", evidenceCount: 3 },
  });
  assert.equal(submitted.correlationId, "milestone:ms_1:submitted");
  assert.throws(() => buildMilestoneV2Event({
    eventType: "milestone.created.v1", tenantId: TENANT, orgId: "o", actorUserId: "u", requestId: "r",
    effectsMode: "on", milestoneId: "ms_1",
    payload: { milestoneId: "ms_1", projectId: "p", jobId: "j", sequence: 1, amount: 10, title: "texto libre" },
  }), "created.v1 es strict: el título no viaja");
  assert.throws(() => buildMilestoneV2Event({
    eventType: "milestone.revision_requested.v1", tenantId: TENANT, orgId: "o", actorUserId: "u", requestId: "r",
    effectsMode: "on", milestoneId: "ms_1",
    payload: { milestoneId: "ms_1", projectId: "p", jobId: "j", requestedById: "u", instructions: "x".repeat(2001) },
  }));
});

// ── Repositorio: atomicidad (F1 §8) ──────────────────────────────────────────

function makeRepositoryHarness() {
  const committed: Record<string, any> = {
    id: "ms_1", projectId: "p_1", title: "Demolición", amount: { toNumber: () => 500 }, sequence: 1, status: "SUBMITTED",
    project: { jobId: "j_1", assignedProOrgId: "org_pro", job: { clientOrgId: "org_client" } },
  };
  let transactions = 0;
  const outbox: unknown[] = [];
  const prisma = {
    milestone: {
      async findFirst() { return { ...committed }; },
    },
    evidence: { async count() { return 2; } },
    milestoneEvidenceItem: { async findMany() { return []; } },
    paymentTxn: { async findFirst() { return null; } },
    async $transaction(callback: (tx: unknown) => Promise<unknown>) {
      transactions += 1;
      const staged = { ...committed };
      const stagedOutbox: unknown[] = [];
      const tx = {
        async $queryRaw() { return [{ status: "IN_PROGRESS" }]; },
        milestone: {
          async findUnique() { return { project: { jobId: "j_1" } }; },
          async updateMany({ where, data }: any) {
            if (staged.status !== where.status) return { count: 0 };
            Object.assign(staged, data);
            return { count: 1 };
          },
          async findUniqueOrThrow() { return { ...staged }; },
        },
        domainOutboxEvent: { async create({ data }: any) { stagedOutbox.push(data); } },
      };
      const result = await callback(tx);
      Object.assign(committed, staged);
      outbox.push(...stagedOutbox);
      return result;
    },
  };
  const repository = new MilestonesRepository(prisma as never, { async ensureActorContext() {} } as never);
  return { repository, committed, outbox, transactions: () => transactions };
}

const DB = { DATABASE_URL: "postgres://fake/db" };

test("atomicidad: si el hook (insert en el outbox) falla, la transición se revierte", async () => {
  await withEnv(DB, async () => {
    const h = makeRepositoryHarness();
    await assert.rejects(
      h.repository.reject({ ...CLIENT, milestoneId: "ms_1", reason: "Faltan fotos" }, async () => {
        throw new Error("outbox insert failed");
      }),
      /outbox insert failed/,
    );
    assert.equal(h.committed.status, "SUBMITTED");
  });
});

test("atomicidad: con hook, transición y evento comparten transacción y el hook recibe projectId/jobId", async () => {
  await withEnv(DB, async () => {
    const h = makeRepositoryHarness();
    const seen: any[] = [];
    await h.repository.reject({ ...CLIENT, milestoneId: "ms_1", reason: "Faltan fotos" }, async (tx: any, written: any) => {
      seen.push(written);
      await tx.domainOutboxEvent.create({ data: { eventType: "milestone.rejected.v1" } });
    });
    assert.equal(h.committed.status, "REJECTED");
    assert.equal(h.transactions(), 1);
    assert.deepEqual(seen, [{ milestoneId: "ms_1", projectId: "p_1", jobId: "j_1" }]);
    assert.deepEqual(h.outbox, [{ eventType: "milestone.rejected.v1" }]);
  });
});

// ── Servicio: off / shadow / on ──────────────────────────────────────────────

const RECORD = { id: "ms_1", tenantId: TENANT, projectId: "p_1", title: "Demolición", amount: 500, sequence: 1, status: "submitted", evidenceCount: 2 };

function makeServiceHarness(opts: { hookRuns?: boolean } = {}) {
  const emits: Array<{ event: any; options: unknown }> = [];
  const outbox: any[] = [];
  const bestEffort: any[] = [];
  const directNotifications: any[] = [];
  const tx = {
    evidence: { async count() { return 2; } },
    milestone: { async findUniqueOrThrow() { return { amount: "500" }; } },
  };
  const run = async (hook: any, status: string) => {
    if (hook && opts.hookRuns !== false) await hook(tx, { milestoneId: "ms_1", projectId: "p_1", jobId: "j_1" });
    return { ...RECORD, status };
  };
  const repository = {
    async create(_i: unknown, hook: unknown) { return run(hook, "draft"); },
    async submit(_i: unknown, hook: unknown) { return run(hook, "submitted"); },
    async approve(_i: unknown, hook: unknown) { return run(hook, "approved"); },
    async reject(_i: unknown, hook: unknown) { return run(hook, "rejected"); },
    async requestChanges(_i: unknown, hook: unknown) { return run(hook, "draft"); },
    async getEventContext() {
      return { milestoneId: "ms_1", projectId: "p_1", jobId: "j_1", evidenceCount: 2, proUserId: "user_pro", clientUserId: "user_client" };
    },
    async checkAllMilestonesApproved() { return false; },
  };
  const outboxRepository = {
    async create(client: unknown, event: any) { (client === tx ? outbox : bestEffort).push(event); },
  };
  const service = new MilestonesService(
    repository as never,
    { async append() {} } as never,
    { async emit(event: unknown, _ctx: unknown, options?: unknown) { emits.push({ event, options }); return []; } } as never,
    { async append() {} } as never,
    undefined,
    undefined,
    undefined,
    { async handleEvent(input: unknown) { directNotifications.push(input); } } as never,
    undefined,
    {} as never,
    outboxRepository as never,
  );
  return { service, emits, outbox, bestEffort, directNotifications };
}

async function runAllWrites(service: any) {
  await service.create({ ...CLIENT, projectId: "p_1", title: "Demolición", amount: 500, sequence: 1 });
  await service.submit({ ...PRO, milestoneId: "ms_1" });
  await service.approve({ ...CLIENT, milestoneId: "ms_1" });
  await service.reject({ ...CLIENT, milestoneId: "ms_1", reason: "Faltan fotos del baño" });
  await service.requestChanges({ ...CLIENT, milestoneId: "ms_1", reason: "Subir fotos con luz natural" });
  await new Promise((resolve) => setImmediate(resolve));
}

test("off: sin eventos v2, bus completo, best-effort SAT-007 y notificación directa como hoy", async () => {
  await withEnv(OFF, async () => {
    const h = makeServiceHarness();
    await runAllWrites(h.service);
    assert.equal(h.outbox.length, 0);
    assert.deepEqual(h.bestEffort.map((e) => e.eventType), ["milestone.approved.v1", "milestone.rejected.v1"]);
    assert.equal(h.bestEffort[0].metadata, undefined, "sin modo sellado: milestone-effects.v1 no aplica");
    assert.ok(h.emits.every((e) => e.options === undefined));
    assert.equal(h.directNotifications.length, 1);
  });
});

test("shadow: los 5 eventos en la transacción (approved/rejected ya no best-effort, D4) y efectos legacy intactos", async () => {
  await withEnv(mode("shadow"), async () => {
    const h = makeServiceHarness();
    await runAllWrites(h.service);
    assert.deepEqual(h.outbox.map((e) => e.eventType), [
      "milestone.created.v1", "milestone.submitted.v1", "milestone.approved.v1",
      "milestone.rejected.v1", "milestone.revision_requested.v1",
    ]);
    assert.equal(h.bestEffort.length, 0, "sin doble escritura para satélites");
    assert.equal(h.outbox[2].payload.amount, 500);
    assert.ok(h.emits.every((e) => e.options === undefined));
    assert.equal(h.directNotifications.length, 1);
  });
});

test("on (D3): emit legacy solo auditoría y sin notificación directa (la envía el consumidor)", async () => {
  await withEnv(mode("on"), async () => {
    const h = makeServiceHarness();
    await runAllWrites(h.service);
    assert.ok(h.outbox.every((e) => e.metadata.effectsMode === "on"));
    assert.ok(h.emits.every((e) => (e.options as any)?.effects === "audit-only"));
    assert.equal(h.directNotifications.length, 0);
  });
});

test("si el repositorio no ejecuta el hook (persistencia en memoria), on degrada a off: no se pierde ningún efecto", async () => {
  await withEnv(mode("on"), async () => {
    const h = makeServiceHarness({ hookRuns: false });
    await runAllWrites(h.service);
    assert.equal(h.outbox.length, 0);
    assert.equal(h.bestEffort.length, 2);
    assert.ok(h.emits.every((e) => e.options === undefined));
    assert.equal(h.directNotifications.length, 1);
  });
});

test("un motivo de más de 2000 caracteres se rechaza antes de escribir (antes: commit y luego 500)", async () => {
  await withEnv(OFF, async () => {
    const h = makeServiceHarness();
    await assert.rejects(h.service.reject({ ...CLIENT, milestoneId: "ms_1", reason: "x".repeat(2001) }), (e: any) => e.getStatus() === 400);
    await assert.rejects(h.service.requestChanges({ ...CLIENT, milestoneId: "ms_1", reason: "x".repeat(2001) }), (e: any) => e.getStatus() === 400);
    assert.equal(h.emits.length, 0);
  });
});

test("paridad: el evento legacy y la notificación directa reconstruidos coinciden con lo que emite el servicio (5 tipos)", async () => {
  await withEnv(mode("shadow"), async () => {
    const h = makeServiceHarness();
    await runAllWrites(h.service);
    const snapshot = { title: "Demolición", proUserId: "user_pro", clientUserId: "user_client" };
    const strip = (e: any) => {
      const copy = JSON.parse(JSON.stringify(e));
      copy.meta.occurredAt = "<t>";
      if (copy.payload.submittedAt) copy.payload.submittedAt = "<t>";
      return copy;
    };
    for (let i = 0; i < 5; i++) {
      const emitted = strip(semseEventSchema.parse(h.emits[i]!.event));
      const rebuilt = buildLegacyMilestoneEvents(h.outbox[i], snapshot);
      assert.deepEqual(strip(semseEventSchema.parse(rebuilt.legacy)), emitted, `paridad ${h.outbox[i].eventType}`);
      if (h.outbox[i].eventType === "milestone.approved.v1") {
        assert.deepEqual(rebuilt.direct, [{ eventType: (h.directNotifications[0] as any).eventType, payload: (h.directNotifications[0] as any).payload }]);
      } else {
        assert.deepEqual(rebuilt.direct, []);
      }
    }
  });
});

// ── Consumidor milestone-effects.v1 ──────────────────────────────────────────

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

function v2(eventType: string, effectsMode: "shadow" | "on", payload: Record<string, unknown>) {
  return buildMilestoneV2Event({
    eventType: eventType as never, tenantId: TENANT, orgId: "org_x", actorUserId: "user_actor", requestId: "req_9",
    effectsMode, milestoneId: "ms_1", payload: { milestoneId: "ms_1", projectId: "p_1", jobId: "j_1", ...payload },
  });
}

function makeConsumerHarness(opts: { milestoneTenant?: string } = {}) {
  let receipt: Record<string, any> | undefined;
  const calls: string[] = [];
  const tx = {
    async $executeRaw() { receipt ??= { id: "rc", status: "PENDING", attempts: 0, maxAttempts: 5, resultJson: null }; return 1; },
    async $queryRaw() { return receipt ? [receipt] : []; },
    domainEventConsumption: { async update({ data }: any) { Object.assign(receipt!, data); } },
    auditLog: { async create() {} },
  };
  const visible = (where: any) => where.project?.tenantId === (opts.milestoneTenant ?? TENANT);
  const prisma = {
    domainEventConsumption: { async findUnique() { return receipt ? { status: receipt.status, resultJson: receipt.resultJson } : null; } },
    milestone: {
      async findFirst({ where, select }: any) {
        if (!visible(where)) return null;
        if (select.title) return { title: "Demolición" };
        return {
          id: "ms_1", projectId: "p_1",
          project: { jobId: "j_1", job: { clientOrgId: "org_client", reservations: [{ professionalId: "user_pro" }], contract: { clientUserId: "user_client" } } },
          _count: { evidence: 2 },
        };
      },
    },
    membership: { async findFirst() { return null; } },
    async $transaction(cb: (t: typeof tx) => Promise<unknown>) { return cb(tx); },
  };
  const notifications = { async handleEvent(input: any) { calls.push(`notify:${input.eventType}:${input.payload.proUserId ?? input.payload.clientUserId ?? "-"}`); } };
  const router = { async route(event: any) { calls.push(`route:${event.type}:${event.triggers.join("+")}`); return []; } };
  const consumer = new MilestoneEffectsConsumer(prisma as never, notifications as never, router as never);
  return { consumer, calls, receipt: () => receipt };
}

test("consumidor shadow: no ejecuta nada y registra notificaciones y triggers que haría", async () => {
  const h = makeConsumerHarness();
  const result = await h.consumer.consume(storedFrom(v2("milestone.submitted.v1", "shadow", { professionalId: "user_pro", evidenceCount: 2 })) as never);
  assert.deepEqual(h.calls, []);
  assert.equal(result.effect, "no_op");
  assert.deepEqual(result.triggers, ["evidence-coach", "notification", "audit"]);
  // Brecha legacy reproducida a propósito (paridad): el esquema v1 de milestone.submitted no declara clientUserId,
  // zod lo descarta en el bus y el cliente nunca recibe aviso. Ver el reporte del slice.
  assert.deepEqual(result.notifications, []);
});

test("consumidor on (approved): trigger, notificación legacy y la directa al profesional; sin repetir en duplicado", async () => {
  const h = makeConsumerHarness();
  const stored = storedFrom(v2("milestone.approved.v1", "on", { reviewerId: "user_client", amount: 500 }));
  const result = await h.consumer.consume(stored as never);
  assert.deepEqual(h.calls, [
    "route:milestone.approved:notification+audit",
    "notify:milestone.approved:-",
    "notify:milestone.approved:user_pro",
  ]);
  assert.deepEqual(result.notifications, [{ userId: "user_pro", type: "milestone_approved" }]);
  const again = await h.consumer.consume(stored as never);
  assert.equal(again.duplicate, true);
  assert.equal(h.calls.length, 3);
});

test("consumidor: hito de otro tenant ⇒ error terminal sin efectos", async () => {
  const h = makeConsumerHarness({ milestoneTenant: "tenant_other" });
  await assert.rejects(
    h.consumer.consume(storedFrom(v2("milestone.rejected.v1", "on", { reviewerId: "u", rejectionReason: "x" })) as never),
    MilestoneEffectsTerminalError,
  );
  assert.deepEqual(h.calls, []);
});

test("fan-out: approved.v1 con modo sellado va a satellite-webhooks.v1 y a milestone-effects.v1; sin modo, solo a satélites", async () => {
  await withEnv({
    SEMSE_EVENT_CONSUMERS_ENABLED: "true",
    SEMSE_EVENT_TYPE_ALLOWLIST: "milestone.approved.v1",
    SEMSE_EVENT_CONSUMER_ALLOWLIST: `satellite-webhooks.v1,${MILESTONE_EFFECTS_CONSUMER}`,
    SATELLITE_WEBHOOKS_ENABLED: undefined,
  }, async () => {
    const withMode = storedFrom(v2("milestone.approved.v1", "shadow", { reviewerId: "user_client", amount: 500 }));
    const withoutMode = { ...withMode, metadataJson: null };
    let current: unknown = withMode;
    let receipt: Record<string, any> | undefined;
    const prisma = {
      domainOutboxEvent: { async findUnique() { return current; } },
      domainEventConsumption: { async findUnique() { return null; } },
      async $transaction(cb: (tx: unknown) => Promise<unknown>) {
        receipt = { id: "rc", status: "PENDING", attempts: 0, maxAttempts: 5, resultJson: null };
        return cb({
          async $executeRaw() { return 1; },
          async $queryRaw() { return [receipt]; },
          domainEventConsumption: { async update({ data }: any) { Object.assign(receipt!, data); } },
          auditLog: { async create() {} },
        });
      },
    };
    const milestoneCalls: string[] = [];
    const service = new DomainEventConsumerService(
      prisma as never, new MetricsService(), undefined, undefined, undefined, undefined, undefined,
      { async consume(e: any) { milestoneCalls.push(e.eventId); return { eventId: e.eventId, consumer: MILESTONE_EFFECTS_CONSUMER, status: "completed", effect: "no_op" }; } } as never,
    );
    const both: any = await service.process(withMode.eventId);
    assert.equal(both.consumer, "fan-out");
    assert.deepEqual(both.consumers.map((r: any) => r.consumer), ["satellite-webhooks.v1", MILESTONE_EFFECTS_CONSUMER]);

    current = withoutMode;
    const single: any = await service.process(withMode.eventId);
    assert.equal(single.consumer, "satellite-webhooks.v1");
    assert.equal(milestoneCalls.length, 1);
  });
});
