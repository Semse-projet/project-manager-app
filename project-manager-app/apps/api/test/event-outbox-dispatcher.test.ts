import test from "node:test";
import assert from "node:assert/strict";

import { SEMSE_DOMAIN_EVENT_QUEUE } from "@semse/shared";
import {
  DomainEventQueueService,
  toDomainEventJobId,
} from "../dist/infrastructure/queue/domain-event-queue.service.js";
import { MetricsService } from "../dist/infrastructure/observability/metrics.service.js";
import {
  OutboxDispatcherService,
  isOutboxDispatchEnabled,
} from "../dist/modules/domain-events/outbox-dispatcher.service.js";

const claimedEvent = {
  eventId: "6e2ac8a0-9116-47b2-8171-1bf41d420c19",
  eventType: "evidence.uploaded.v1",
  attempts: 1,
  maxAttempts: 5,
  recordedAt: new Date("2026-07-13T12:00:00.000Z"),
  replayCount: 0,
};

test("F1-C queue: eventId produces a deterministic BullMQ jobId and bounded retention", async () => {
  const added: Array<{
    name: string;
    data: unknown;
    options: Record<string, unknown>;
  }> = [];
  const service = new DomainEventQueueService();
  (service as unknown as { queue: unknown }).queue = {
    add: async (
      name: string,
      data: unknown,
      options: Record<string, unknown>,
    ) => {
      added.push({ name, data, options });
    },
  };

  await service.enqueueEvent({ eventId: claimedEvent.eventId });

  assert.equal(SEMSE_DOMAIN_EVENT_QUEUE, "semse-domain-events");
  assert.equal(toDomainEventJobId(claimedEvent.eventId), `event-${claimedEvent.eventId}-g0`);
  assert.equal(added.length, 1);
  assert.deepEqual(added[0]?.data, { eventId: claimedEvent.eventId });
  assert.equal(added[0]?.options.jobId, `event-${claimedEvent.eventId}-g0`);
  assert.equal(added[0]?.options.attempts, 5);
  assert.deepEqual(added[0]?.options.backoff, {
    type: "exponential",
    delay: 1_000,
    jitter: 0.5,
  });
  assert.deepEqual(added[0]?.options.removeOnComplete, {
    age: 3_600,
    count: 1_000,
  });
  assert.deepEqual(added[0]?.options.removeOnFail, {
    age: 604_800,
    count: 5_000,
  });
});

test("F1-C dispatcher: successful enqueue acknowledges the same leased event", async () => {
  const acknowledged: Array<Record<string, unknown>> = [];
  const repository = {
    claimBatch: async () => [claimedEvent],
    markPublished: async (input: Record<string, unknown>) => {
      acknowledged.push(input);
      return true;
    },
    markFailed: async () => {
      throw new Error("successful enqueue must not be nacked");
    },
    getMetricsSnapshot: async () => ({
      pendingTotal: 0,
      oldestPendingAgeSeconds: 0,
      deadLetterTotal: 0,
    }),
  };
  const enqueued: Array<{ eventId: string; generation?: number }> = [];
  const queue = {
    enqueueEvent: async (input: { eventId: string; generation?: number }) => {
      enqueued.push(input);
    },
  };
  const service = new OutboxDispatcherService(
    repository as never,
    queue as never,
    new MetricsService(),
  );

  const result = await service.dispatchBatch();

  assert.deepEqual(result, { claimed: 1, published: 1, failed: 0 });
  assert.deepEqual(enqueued, [{ eventId: claimedEvent.eventId, generation: 0 }]);
  assert.equal(acknowledged.length, 1);
  assert.equal(acknowledged[0]?.eventId, claimedEvent.eventId);
  assert.equal(typeof acknowledged[0]?.dispatcherId, "string");
});

test("F1-C dispatcher: Redis failure is durably nacked with retry metadata", async () => {
  const failed: Array<Record<string, unknown>> = [];
  const repository = {
    claimBatch: async () => [claimedEvent],
    markPublished: async () => {
      throw new Error("failed enqueue must not be acknowledged");
    },
    markFailed: async (input: Record<string, unknown>) => {
      failed.push(input);
      return { status: "FAILED", attempts: 1 };
    },
    getMetricsSnapshot: async () => ({
      pendingTotal: 0,
      oldestPendingAgeSeconds: 1,
      deadLetterTotal: 0,
    }),
  };
  const queue = {
    enqueueEvent: async () => {
      throw new Error("connect ECONNREFUSED redis://user:secret@127.0.0.1:1");
    },
  };
  const service = new OutboxDispatcherService(
    repository as never,
    queue as never,
    new MetricsService(),
  );

  const result = await service.dispatchBatch();

  assert.deepEqual(result, { claimed: 1, published: 0, failed: 1 });
  assert.equal(failed.length, 1);
  assert.equal(failed[0]?.eventId, claimedEvent.eventId);
  assert.equal(failed[0]?.attempts, 1);
  assert.match(String(failed[0]?.error), /redis:\/\/\*\*\*@127\.0\.0\.1:1/);
  assert.doesNotMatch(String(failed[0]?.error), /secret/);
});

test("F1-C scheduler: dispatch stays OFF unless the kill switch is explicitly true", () => {
  assert.equal(isOutboxDispatchEnabled({}), false);
  assert.equal(
    isOutboxDispatchEnabled({ SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED: "false" }),
    false,
  );
  assert.equal(
    isOutboxDispatchEnabled({ SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED: "true" }),
    true,
  );
});

test("F1-C metrics: Prometheus output exposes backlog, lag and DLQ gauges", () => {
  const metrics = new MetricsService();
  metrics.recordOutboxSnapshot({
    pendingTotal: 3,
    oldestPendingAgeSeconds: 61,
    deadLetterTotal: 2,
  });
  metrics.recordOutboxPublishLag(1.25);

  const rendered = metrics.renderPrometheus();

  assert.match(rendered, /semse_outbox_pending_total 3/);
  assert.match(rendered, /semse_outbox_oldest_pending_age_seconds 61/);
  assert.match(rendered, /semse_outbox_publish_lag_seconds 1\.25/);
  assert.match(rendered, /semse_event_dlq_total 2/);
});
