import test from "node:test";
import assert from "node:assert/strict";

import { MetricsService } from "../dist/infrastructure/observability/metrics.service.js";
import {
  DomainEventConsumerService,
  EVIDENCE_READINESS_CONSUMER,
} from "../dist/modules/domain-events/domain-event-consumer.service.js";
import {
  calculateEvidenceReadiness,
  isDomainEventConsumersEnabled,
  parseEventConsumerAllowlist,
  redactConsumerError,
} from "../src/modules/domain-events/domain-event-consumer.policy.ts";
import {
  isTerminalDomainEventHttpStatus,
  parseDomainEventJobData,
  processDomainEventQueueJob,
} from "../../worker/src/domain-event-worker.mjs";

const EVENT_ID = "6e2ac8a0-9116-47b2-8171-1bf41d420c19";

test("F1-D readiness: missing, partial and complete are deterministic", () => {
  assert.equal(calculateEvidenceReadiness(["PHOTO", "VIDEO"], []), "missing");
  assert.equal(
    calculateEvidenceReadiness(["PHOTO", "VIDEO"], ["PHOTO"]),
    "partial",
  );
  assert.equal(
    calculateEvidenceReadiness(
      ["PHOTO", "VIDEO"],
      ["VIDEO", "PHOTO", "PHOTO"],
    ),
    "complete",
  );
  assert.equal(calculateEvidenceReadiness([], []), "complete");
});

test("F1-D kill switch and allowlists default to deny", () => {
  assert.equal(isDomainEventConsumersEnabled({}), false);
  assert.equal(
    isDomainEventConsumersEnabled({ SEMSE_EVENT_CONSUMERS_ENABLED: "false" }),
    false,
  );
  assert.equal(
    isDomainEventConsumersEnabled({ SEMSE_EVENT_CONSUMERS_ENABLED: "true" }),
    true,
  );
  assert.deepEqual(parseEventConsumerAllowlist(undefined), new Set());
  assert.deepEqual(
    parseEventConsumerAllowlist(` ${EVIDENCE_READINESS_CONSUMER},other.v1 `),
    new Set([EVIDENCE_READINESS_CONSUMER, "other.v1"]),
  );
});

test("F1-D service rejects before storage access when the kill switch is disabled", async () => {
  const previousValue = process.env.SEMSE_EVENT_CONSUMERS_ENABLED;
  delete process.env.SEMSE_EVENT_CONSUMERS_ENABLED;
  let storageAccessed = false;
  const prisma = {
    domainOutboxEvent: {
      findUnique: async () => {
        storageAccessed = true;
        return null;
      },
    },
  };

  try {
    const service = new DomainEventConsumerService(
      prisma as never,
      new MetricsService(),
    );
    await assert.rejects(
      () => service.process(EVENT_ID),
      (error: Error & { getStatus?: () => number }) =>
        error.getStatus?.() === 503 && /kill switch/i.test(error.message),
    );
    assert.equal(storageAccessed, false);
  } finally {
    if (previousValue === undefined) {
      delete process.env.SEMSE_EVENT_CONSUMERS_ENABLED;
    } else {
      process.env.SEMSE_EVENT_CONSUMERS_ENABLED = previousValue;
    }
  }
});

test("F1-D consumer errors redact credentials before durable persistence", () => {
  assert.equal(
    redactConsumerError(
      new Error("redis://worker:password@redis.internal token=raw-token"),
    ),
    "redis://***@redis.internal token=***",
  );
  assert.equal(redactConsumerError("secret=raw-secret"), "secret=***");
});

test("F1-D worker accepts only an eventId reference, never a canonical payload", () => {
  assert.deepEqual(parseDomainEventJobData({ eventId: EVENT_ID }), {
    eventId: EVENT_ID,
  });
  assert.throws(
    () =>
      parseDomainEventJobData({
        eventId: EVENT_ID,
        eventType: "evidence.uploaded.v1",
        payload: { evidenceId: "evidence_1" },
      }),
    /only eventId/i,
  );
  assert.throws(() => parseDomainEventJobData({ eventId: "not-a-uuid" }), /eventId/i);
});

test("F1-D worker calls the internal route without tenant or event payload", async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const result = await processDomainEventQueueJob({
    jobData: { eventId: EVENT_ID },
    workerId: "worker-f1d",
    postJson: async (path: string, body: unknown) => {
      calls.push({ path, body });
      return { data: { eventId: EVENT_ID, status: "completed" } };
    },
  });

  assert.deepEqual(calls, [
    {
      path: `/v1/domain-events/${EVENT_ID}/process`,
      body: { workerId: "worker-f1d" },
    },
  ]);
  assert.deepEqual(result, {
    eventId: EVENT_ID,
    status: "completed",
  });
});

test("F1-D worker classifies terminal 4xx separately from retryable errors", () => {
  assert.equal(isTerminalDomainEventHttpStatus(400), true);
  assert.equal(isTerminalDomainEventHttpStatus(404), true);
  assert.equal(isTerminalDomainEventHttpStatus(409), true);
  assert.equal(isTerminalDomainEventHttpStatus(408), false);
  assert.equal(isTerminalDomainEventHttpStatus(429), false);
  assert.equal(isTerminalDomainEventHttpStatus(500), false);
});

test("F1-D worker stops BullMQ retries for a terminal API response", async () => {
  await assert.rejects(
    () => processDomainEventQueueJob({
      jobData: { eventId: EVENT_ID },
      workerId: "worker-f1d",
      postJson: async () => {
        throw new Error("HTTP 422 /v1/domain-events/event/process: rejected");
      },
    }),
    (error: Error) => error.name === "UnrecoverableError",
  );
});

test("F1-D metrics expose consumer attempts, duplicates and dead letters", () => {
  const metrics = new MetricsService();
  metrics.recordEventConsumerAttempt(EVIDENCE_READINESS_CONSUMER, "completed");
  metrics.recordEventConsumerAttempt(EVIDENCE_READINESS_CONSUMER, "failed");
  metrics.recordEventConsumerDuplicate(EVIDENCE_READINESS_CONSUMER);
  metrics.recordEventConsumerDeadLetter(EVIDENCE_READINESS_CONSUMER);

  const rendered = metrics.renderPrometheus();
  assert.match(
    rendered,
    /semse_event_consumer_attempts_total\{consumer="evidence-readiness\.v1",outcome="completed"\} 1/,
  );
  assert.match(
    rendered,
    /semse_event_consumer_attempts_total\{consumer="evidence-readiness\.v1",outcome="failed"\} 1/,
  );
  assert.match(
    rendered,
    /semse_event_consumer_duplicates_total\{consumer="evidence-readiness\.v1"\} 1/,
  );
  assert.match(
    rendered,
    /semse_event_consumer_dead_letter_total\{consumer="evidence-readiness\.v1"\} 1/,
  );
});
