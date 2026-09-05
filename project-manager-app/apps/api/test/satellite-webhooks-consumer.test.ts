import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { JOB_MATCHED_V1_SCHEMA_REF } from "@semse/schemas";
import { MetricsService } from "../dist/infrastructure/observability/metrics.service.js";
import {
  DomainEventConsumerService,
  SATELLITE_WEBHOOKS_CONSUMER,
} from "../dist/modules/domain-events/domain-event-consumer.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// SAT-007 Fase D — satellite-webhooks.v1: fan-out a webhooks activos,
// aislamiento del contador de fallos por webhook, y estados no_op/disabled.
// (docs/specs/satellites/SAT-007-outbound-webhooks.spec.md §6/§8)
// ─────────────────────────────────────────────────────────────────────────────

function fakeStoredEvent(overrides: Record<string, unknown>) {
  return {
    eventId: overrides.eventId as string,
    version: 1,
    envelopeVersion: 2,
    tenantId: "tenant_1",
    orgId: "org_1",
    actorType: "system",
    actorId: "SYSTEM",
    correlationId: "request_1",
    causationId: null,
    idempotencyKey: "request_1",
    metadataJson: null,
    traceContextJson: null,
    occurredAt: new Date(),
    recordedAt: new Date(),
    status: "PUBLISHED",
    attempts: 1,
    maxAttempts: 5,
    nextAttemptAt: new Date(),
    lockedAt: null,
    lockExpiresAt: null,
    lockedBy: null,
    publishedAt: new Date(),
    lastError: null,
    replayCount: 0,
    ...overrides,
  };
}

function makeJobMatchedEvent(eventId: string) {
  return fakeStoredEvent({
    eventId,
    eventType: "job.matched.v1",
    module: "jobs",
    entityType: "Job",
    entityId: "job_1",
    schemaRef: JOB_MATCHED_V1_SCHEMA_REF,
    payloadJson: {
      jobId: "job_1",
      jobTitle: "Kitchen remodel",
      trade: "plumbing",
      urgency: "normal",
      matchedUserIds: ["usr_pro_1"],
    },
  });
}

function makeHarness(storedEvent: unknown) {
  let receipt: Record<string, unknown> | undefined;
  const auditEntries: Array<Record<string, unknown>> = [];
  const transaction = {
    async $executeRaw() {
      receipt ??= {
        id: "receipt_1",
        status: "PENDING",
        attempts: 0,
        maxAttempts: 5,
        resultJson: null,
      };
      return 1;
    },
    async $queryRaw() {
      return receipt ? [receipt] : [];
    },
    domainEventConsumption: {
      async update({ data }: { data: Record<string, unknown> }) {
        Object.assign(receipt!, data);
        return receipt;
      },
    },
    auditLog: {
      async create({ data }: { data: Record<string, unknown> }) {
        auditEntries.push(data);
      },
    },
  };
  const prisma = {
    domainOutboxEvent: {
      async findUnique() {
        return storedEvent;
      },
    },
    domainEventConsumption: {
      async findUnique() {
        return receipt ? { status: receipt.status, resultJson: receipt.resultJson } : null;
      },
    },
    async $transaction(callback: (tx: typeof transaction) => Promise<unknown>) {
      return callback(transaction);
    },
  };
  return {
    prisma,
    getReceipt: () => receipt,
    getAuditEntries: () => auditEntries,
  };
}

function withEnv(vars: Record<string, string>, fn: () => Promise<void>) {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }
  return fn().finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("satellite-webhooks.v1: entrega a todos los webhooks ACTIVE suscritos, firma el body y registra éxito/fallo por webhook", async () => {
  await withEnv(
    {
      SEMSE_EVENT_CONSUMERS_ENABLED: "true",
      SEMSE_EVENT_CONSUMER_ALLOWLIST: SATELLITE_WEBHOOKS_CONSUMER,
      SEMSE_EVENT_TYPE_ALLOWLIST: "job.matched.v1",
      SATELLITE_WEBHOOKS_ENABLED: "true",
    },
    async () => {
      const eventId = randomUUID();
      const harness = makeHarness(makeJobMatchedEvent(eventId));

      const successCalls: string[] = [];
      const failureCalls: string[] = [];
      const satelliteWebhooksService = {
        async findActiveForEvent(bareEventType: string) {
          assert.equal(bareEventType, "job.matched");
          return [
            { id: "whk_a", url: "https://a.example.com/hook", secret: "secret-a-secret-a-secret-a-32ch" },
            { id: "whk_b", url: "https://b.example.com/hook", secret: "secret-b-secret-b-secret-b-32ch" },
          ];
        },
        async recordDeliverySuccess(webhookId: string) {
          successCalls.push(webhookId);
        },
        async recordDeliveryFailure(webhookId: string) {
          failureCalls.push(webhookId);
          return false;
        },
      };

      const consumer = new DomainEventConsumerService(
        harness.prisma as never,
        new MetricsService(),
        undefined,
        undefined,
        satelliteWebhooksService as never,
      );

      const deliveredUrls: string[] = [];
      (consumer as unknown as { deliverSatelliteWebhookFn: (...args: unknown[]) => Promise<unknown> }).deliverSatelliteWebhookFn =
        async (url: string, _body: string, signature: string) => {
          deliveredUrls.push(url);
          assert.ok(signature.startsWith("sha256="));
          if (url.includes("a.example.com")) {
            return { delivered: true, statusCode: 200 };
          }
          return { delivered: false, reason: "http_503" };
        };

      const result = await consumer.process(eventId);

      assert.equal(result.consumer, SATELLITE_WEBHOOKS_CONSUMER);
      assert.equal(result.effect, "updated");
      assert.equal(deliveredUrls.length, 2);
      assert.deepEqual(successCalls, ["whk_a"]);
      assert.deepEqual(failureCalls, ["whk_b"]);
      assert.deepEqual(
        result.deliveries?.map((d) => d.webhookId).sort(),
        ["whk_a", "whk_b"],
      );
      assert.equal(result.deliveries?.find((d) => d.webhookId === "whk_a")?.delivered, true);
      assert.equal(result.deliveries?.find((d) => d.webhookId === "whk_b")?.delivered, false);
      assert.equal(harness.getReceipt()?.status, "COMPLETED");
      assert.equal(harness.getAuditEntries().length, 1);

      // Reprocesar el mismo eventId no vuelve a entregar (idempotencia del consumer).
      const duplicate = await consumer.process(eventId);
      assert.equal(duplicate.duplicate, true);
      assert.equal(deliveredUrls.length, 2);
    },
  );
});

test("satellite-webhooks.v1: sin webhooks activos para el evento ⇒ effect no_op, sin llamadas de entrega", async () => {
  await withEnv(
    {
      SEMSE_EVENT_CONSUMERS_ENABLED: "true",
      SEMSE_EVENT_CONSUMER_ALLOWLIST: SATELLITE_WEBHOOKS_CONSUMER,
      SEMSE_EVENT_TYPE_ALLOWLIST: "job.matched.v1",
      SATELLITE_WEBHOOKS_ENABLED: "true",
    },
    async () => {
      const eventId = randomUUID();
      const harness = makeHarness(makeJobMatchedEvent(eventId));

      const satelliteWebhooksService = {
        async findActiveForEvent() {
          return [];
        },
      };
      const consumer = new DomainEventConsumerService(
        harness.prisma as never,
        new MetricsService(),
        undefined,
        undefined,
        satelliteWebhooksService as never,
      );
      let deliveryCalls = 0;
      (consumer as unknown as { deliverSatelliteWebhookFn: () => Promise<unknown> }).deliverSatelliteWebhookFn =
        async () => {
          deliveryCalls += 1;
          return { delivered: true, statusCode: 200 };
        };

      const result = await consumer.process(eventId);
      assert.equal(result.effect, "no_op");
      assert.equal(deliveryCalls, 0);
    },
  );
});

test("satellite-webhooks.v1: kill switch apagado o servicio ausente ⇒ effect disabled, sin llamadas de entrega", async () => {
  await withEnv(
    {
      SEMSE_EVENT_CONSUMERS_ENABLED: "true",
      SEMSE_EVENT_CONSUMER_ALLOWLIST: SATELLITE_WEBHOOKS_CONSUMER,
      SEMSE_EVENT_TYPE_ALLOWLIST: "job.matched.v1",
      SATELLITE_WEBHOOKS_ENABLED: "false",
    },
    async () => {
      const eventId = randomUUID();
      const harness = makeHarness(makeJobMatchedEvent(eventId));

      let findActiveCalls = 0;
      const satelliteWebhooksService = {
        async findActiveForEvent() {
          findActiveCalls += 1;
          return [];
        },
      };
      const consumer = new DomainEventConsumerService(
        harness.prisma as never,
        new MetricsService(),
        undefined,
        undefined,
        satelliteWebhooksService as never,
      );

      const result = await consumer.process(eventId);
      assert.equal(result.effect, "disabled");
      assert.equal(findActiveCalls, 0);
    },
  );
});
