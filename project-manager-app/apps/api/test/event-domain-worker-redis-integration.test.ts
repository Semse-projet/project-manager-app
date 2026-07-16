import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Queue, QueueEvents, Worker } from "bullmq";
import { SEMSE_DOMAIN_EVENT_QUEUE } from "@semse/shared";

import { processDomainEventQueueJob } from "../../worker/src/domain-event-worker.mjs";

const redisTest = process.env.REDIS_URL ? test : test.skip;

function redisConnection() {
  const url = new URL(process.env.REDIS_URL!);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
  };
}

redisTest("F1-D Redis integration: canonical queue carries only eventId and closes cleanly", async () => {
  const prefix = `semse-f1d-${randomUUID()}`;
  const connection = redisConnection();
  const queue = new Queue(SEMSE_DOMAIN_EVENT_QUEUE, { connection, prefix });
  const queueEvents = new QueueEvents(SEMSE_DOMAIN_EVENT_QUEUE, { connection, prefix });
  const calls: Array<{ path: string; body: unknown }> = [];
  const worker = new Worker(
    SEMSE_DOMAIN_EVENT_QUEUE,
    async (job) => processDomainEventQueueJob({
      jobData: job.data,
      workerId: "worker-f1d-redis",
      postJson: async (path: string, body: unknown) => {
        calls.push({ path, body });
        return { data: { eventId: job.data.eventId, status: "completed" } };
      },
    }),
    { connection, prefix, concurrency: 2 },
  );

  try {
    await queueEvents.waitUntilReady();
    await worker.waitUntilReady();
    const eventId = randomUUID();
    const job = await queue.add(
      "evidence.uploaded.v1",
      { eventId },
      { jobId: eventId, attempts: 5 },
    );
    const result = await job.waitUntilFinished(queueEvents, 5_000);

    assert.deepEqual(job.data, { eventId });
    assert.deepEqual(calls, [{
      path: `/v1/domain-events/${eventId}/process`,
      body: { workerId: "worker-f1d-redis" },
    }]);
    assert.deepEqual(result, { eventId, status: "completed" });
  } finally {
    await worker.close();
    await queueEvents.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
});

redisTest("F1-D Redis integration: terminal 422 stops before configured retry budget", async () => {
  const prefix = `semse-f1d-${randomUUID()}`;
  const connection = redisConnection();
  const queue = new Queue(SEMSE_DOMAIN_EVENT_QUEUE, { connection, prefix });
  const queueEvents = new QueueEvents(SEMSE_DOMAIN_EVENT_QUEUE, { connection, prefix });
  let calls = 0;
  const worker = new Worker(
    SEMSE_DOMAIN_EVENT_QUEUE,
    async (job) => processDomainEventQueueJob({
      jobData: job.data,
      workerId: "worker-f1d-redis",
      postJson: async () => {
        calls += 1;
        throw new Error("HTTP 422 domain event rejected");
      },
    }),
    { connection, prefix, concurrency: 2 },
  );

  try {
    await queueEvents.waitUntilReady();
    await worker.waitUntilReady();
    const eventId = randomUUID();
    const job = await queue.add(
      "evidence.uploaded.v1",
      { eventId },
      { jobId: eventId, attempts: 5, backoff: { type: "fixed", delay: 10 } },
    );
    await assert.rejects(() => job.waitUntilFinished(queueEvents, 5_000));
    const persisted = await queue.getJob(eventId);

    assert.equal(calls, 1);
    assert.equal(persisted?.attemptsMade, 1);
    assert.equal(await persisted?.getState(), "failed");
    assert.match(persisted?.failedReason ?? "", /Terminal domain event consumer response/i);
  } finally {
    await worker.close();
    await queueEvents.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
});
