import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { InternalServerErrorException, UnprocessableEntityException } from "@nestjs/common";

import { MetricsService } from "../dist/infrastructure/observability/metrics.service.js";
import { DomainEventConsumerService } from "../dist/modules/domain-events/domain-event-consumer.service.js";
import {
  dispatchToConsumers,
  groupDescriptorsByEventType,
} from "../dist/modules/domain-events/domain-event-fanout.js";

// ─────────────────────────────────────────────────────────────────────────────
// Event backbone F2 — fan-out del registro de consumidores (prerequisito del slice 2,
// docs/specs/platform/event-backbone-f2-milestones.plan.md §2a).
// ─────────────────────────────────────────────────────────────────────────────

const EVENT = { eventId: "00000000-0000-4000-8000-000000000001", eventType: "milestone.approved.v1" };

type Result = { eventId: string; consumer: string; status: "completed"; effect: string; duplicate?: boolean };

function consumer(name: string, opts: {
  effect?: string;
  fail?: unknown;
  appliesTo?: (e: typeof EVENT) => boolean;
  log?: string[];
} = {}) {
  return {
    eventType: EVENT.eventType,
    consumerName: name,
    appliesTo: opts.appliesTo,
    async handle(event: typeof EVENT): Promise<Result> {
      opts.log?.push(name);
      if (opts.fail !== undefined) throw opts.fail;
      return { eventId: event.eventId, consumer: name, status: "completed", effect: opts.effect ?? "updated" };
    },
  };
}

const all = (...names: string[]) => new Set(names);

test("registro: agrupa por tipo y rechaza un par (tipo, consumidor) duplicado", () => {
  const grouped = groupDescriptorsByEventType([consumer("a"), consumer("b"), { ...consumer("c"), eventType: "x.y.v1" }]);
  assert.deepEqual(grouped.get(EVENT.eventType)!.map((d) => d.consumerName), ["a", "b"]);
  assert.throws(() => groupDescriptorsByEventType([consumer("a"), consumer("a")]), /Duplicate domain event consumer/);
});

test("un solo consumidor aplicable: mismo resultado y mismo 503 que el registro 1:1", async () => {
  const only = consumer("satellite-webhooks.v1");
  const result = await dispatchToConsumers({ event: EVENT, identity: {}, descriptors: [only], consumerAllowlist: all("satellite-webhooks.v1") });
  assert.deepEqual(result, { eventId: EVENT.eventId, consumer: "satellite-webhooks.v1", status: "completed", effect: "updated" });

  const log: string[] = [];
  await assert.rejects(
    dispatchToConsumers({ event: EVENT, identity: {}, descriptors: [consumer("satellite-webhooks.v1", { log })], consumerAllowlist: all() }),
    (error: any) => error.getStatus() === 503 && error.getResponse().consumer === "satellite-webhooks.v1" && !error.getResponse().consumers,
  );
  assert.deepEqual(log, [], "un consumidor no habilitado no se ejecuta");
});

test("appliesTo: un consumidor que no aplica no participa (ni bloquea por allowlist)", async () => {
  const result = await dispatchToConsumers({
    event: EVENT,
    identity: {},
    descriptors: [consumer("satellite-webhooks.v1"), consumer("milestone-effects.v1", { appliesTo: () => false })],
    consumerAllowlist: all("satellite-webhooks.v1"),
  });
  assert.equal((result as Result).consumer, "satellite-webhooks.v1");
});

test("varios consumidores: corren todos y se agrega el resultado", async () => {
  const log: string[] = [];
  const result: any = await dispatchToConsumers({
    event: EVENT,
    identity: {},
    descriptors: [consumer("a", { effect: "no_op", log }), consumer("b", { effect: "updated", log })],
    consumerAllowlist: all("a", "b"),
  });
  assert.deepEqual(log, ["a", "b"]);
  assert.equal(result.consumer, "fan-out");
  assert.equal(result.effect, "updated");
  assert.deepEqual(result.consumers.map((r: Result) => r.consumer), ["a", "b"]);
});

test("varios consumidores: un fallo no impide el primer intento del siguiente; el reintentable gana al terminal", async () => {
  const log: string[] = [];
  const terminal = new UnprocessableEntityException("dead letter");
  const retryable = new InternalServerErrorException("retry");
  await assert.rejects(
    dispatchToConsumers({
      event: EVENT,
      identity: {},
      descriptors: [consumer("a", { fail: terminal, log }), consumer("b", { fail: retryable, log }), consumer("c", { log })],
      consumerAllowlist: all("a", "b", "c"),
    }),
    (error: unknown) => error === retryable,
  );
  assert.deepEqual(log, ["a", "b", "c"]);

  await assert.rejects(
    dispatchToConsumers({
      event: EVENT, identity: {}, descriptors: [consumer("a", { fail: terminal }), consumer("b")], consumerAllowlist: all("a", "b"),
    }),
    (error: unknown) => error === terminal,
  );

  const plain = new Error("socket hang up");
  await assert.rejects(
    dispatchToConsumers({
      event: EVENT, identity: {}, descriptors: [consumer("a", { fail: terminal }), consumer("b", { fail: plain })], consumerAllowlist: all("a", "b"),
    }),
    (error: unknown) => error === plain,
    "un error no HTTP es reintentable",
  );
});

test("varios consumidores: uno aplicable sin habilitar ⇒ los demás corren y luego 503 (no se salta en silencio)", async () => {
  const log: string[] = [];
  await assert.rejects(
    dispatchToConsumers({
      event: EVENT, identity: {}, descriptors: [consumer("a", { log }), consumer("b", { log })], consumerAllowlist: all("a"),
    }),
    (error: any) => error.getStatus() === 503 && error.getResponse().consumer === "b",
  );
  assert.deepEqual(log, ["a"]);
});

test("servicio: los tipos con un solo consumidor siguen igual (registro → dead letter de dispute-effects intacto)", async () => {
  const previous = { ...process.env };
  process.env.SEMSE_EVENT_CONSUMERS_ENABLED = "true";
  process.env.SEMSE_EVENT_TYPE_ALLOWLIST = "dispute.opened.v1";
  delete process.env.SEMSE_EVENT_CONSUMER_ALLOWLIST;
  try {
    const eventId = randomUUID();
    const prisma = { domainOutboxEvent: { async findUnique() { return { eventId, eventType: "dispute.opened.v1", tenantId: "t" }; } } };
    const service = new DomainEventConsumerService(prisma as never, new MetricsService());
    await assert.rejects(
      service.process(eventId),
      (error: any) => error.getStatus() === 503 && error.getResponse().consumer === "dispute-effects.v1",
    );
  } finally {
    for (const key of ["SEMSE_EVENT_CONSUMERS_ENABLED", "SEMSE_EVENT_TYPE_ALLOWLIST", "SEMSE_EVENT_CONSUMER_ALLOWLIST"]) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
