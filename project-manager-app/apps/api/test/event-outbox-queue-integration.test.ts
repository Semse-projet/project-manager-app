import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { Queue, type QueueOptions } from "bullmq";
import { Redis } from "ioredis";
import { SEMSE_DOMAIN_EVENT_QUEUE } from "@semse/shared";
import {
  DomainEventQueueService,
  toDomainEventJobId,
} from "../dist/infrastructure/queue/domain-event-queue.service.js";

const redisTest = process.env.REDIS_URL ? test : test.skip;

redisTest(
  "F1-C Redis integration: BullMQ stores one deterministic ingress job",
  async () => {
    const eventId = randomUUID();
    const jobId = toDomainEventJobId(eventId);
    const service = new DomainEventQueueService();
    const inspectorConnection = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
    });
    const inspector = new Queue(SEMSE_DOMAIN_EVENT_QUEUE, {
      connection: inspectorConnection as QueueOptions["connection"],
    });

    try {
      await service.enqueueEvent({ eventId });
      await service.enqueueEvent({ eventId });

      assert.equal(jobId, `event-${eventId}-g0`);
      const persisted = await inspector.getJob(jobId);
      assert.ok(persisted);
      assert.deepEqual(persisted.data, { eventId });
      assert.equal(persisted.opts.attempts, 5);
      assert.deepEqual(persisted.opts.backoff, {
        type: "exponential",
        delay: 1_000,
        jitter: 0.5,
      });
      assert.equal(persisted.opts.removeOnComplete?.count, 1_000);
      assert.equal(persisted.opts.removeOnFail?.count, 5_000);
      await persisted.remove();
    } finally {
      await service.onModuleDestroy();
      await inspector.close();
      if (inspectorConnection.status !== "end") {
        inspectorConnection.disconnect();
      }
    }
  },
);
