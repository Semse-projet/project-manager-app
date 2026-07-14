import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

import { MetricsService } from "../dist/infrastructure/observability/metrics.service.js";
import { OutboxDispatcherService } from "../dist/modules/domain-events/outbox-dispatcher.service.js";
import { OutboxRepository } from "../dist/modules/domain-events/outbox.repository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");

loadEnv({ path: path.join(repoRoot, "packages/db/.env") });

const prisma = new PrismaClient();
const dbTest = process.env.DATABASE_URL ? test : test.skip;

function uniqueId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function createFixture(eventCount: number) {
  const tenantId = uniqueId("tenant_f1c");
  await prisma.tenant.create({
    data: {
      id: tenantId,
      slug: uniqueId("slug"),
      name: `Tenant ${tenantId}`,
      status: "active",
    },
  });

  const eventIds = Array.from({ length: eventCount }, () => randomUUID());
  await prisma.domainOutboxEvent.createMany({
    data: eventIds.map((eventId, index) => ({
      eventId,
      eventType: "evidence.uploaded.v1",
      version: 1,
      envelopeVersion: 2,
      tenantId,
      orgId: "org_f1c",
      module: "evidence",
      entityType: "Evidence",
      entityId: `evidence_${index}`,
      actorType: "user",
      actorId: "user_f1c",
      correlationId: `correlation_${index}`,
      idempotencyKey: `evidence.uploaded.v1:request_${index}`,
      schemaRef: "https://schemas.semseproject.com/events/evidence.uploaded.v1.json",
      payloadJson: {
        evidenceId: `evidence_${index}`,
        projectId: "project_f1c",
        jobId: "job_f1c",
        uploaderId: "user_f1c",
        kind: "PHOTO",
        bucketKey: `tenants/${tenantId}/evidence/${index}.jpg`,
      },
      occurredAt: new Date(Date.now() - index * 1_000),
    })),
  });

  return { tenantId, eventIds };
}

async function cleanupFixture(tenantId: string) {
  await prisma.domainEventConsumption.deleteMany({ where: { tenantId } });
  await prisma.domainOutboxEvent.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
}

dbTest(
  "F1-C integration: two dispatchers claim disjoint rows with SKIP LOCKED",
  async (t) => {
    const fixture = await createFixture(8);
    t.after(async () => cleanupFixture(fixture.tenantId));
    const firstRepository = new OutboxRepository(prisma as never);
    const secondRepository = new OutboxRepository(prisma as never);
    const now = new Date();

    const [first, second] = await Promise.all([
      firstRepository.claimBatch({
        dispatcherId: "dispatcher_a",
        batchSize: 5,
        leaseMs: 30_000,
        now,
      }),
      secondRepository.claimBatch({
        dispatcherId: "dispatcher_b",
        batchSize: 5,
        leaseMs: 30_000,
        now,
      }),
    ]);

    const firstIds = new Set(first.map((event) => event.eventId));
    const secondIds = new Set(second.map((event) => event.eventId));
    assert.equal(first.length + second.length, 8);
    assert.deepEqual(
      [...firstIds].filter((eventId) => secondIds.has(eventId)),
      [],
    );
    assert.ok(first.every((event) => event.attempts === 1));
    assert.ok(second.every((event) => event.attempts === 1));
  },
);

dbTest(
  "F1-C integration: an expired lease becomes eligible for a new dispatcher",
  async (t) => {
    const fixture = await createFixture(1);
    t.after(async () => cleanupFixture(fixture.tenantId));
    const eventId = fixture.eventIds[0]!;
    await prisma.domainOutboxEvent.update({
      where: { eventId },
      data: {
        status: "CLAIMED",
        attempts: 1,
        lockedAt: new Date("2026-07-13T10:00:00.000Z"),
        lockExpiresAt: new Date("2026-07-13T10:00:10.000Z"),
        lockedBy: "stale_dispatcher",
      },
    });

    const repository = new OutboxRepository(prisma as never);
    const claimed = await repository.claimBatch({
      dispatcherId: "replacement_dispatcher",
      batchSize: 1,
      leaseMs: 30_000,
      now: new Date("2026-07-13T10:01:00.000Z"),
    });

    assert.equal(claimed.length, 1);
    assert.equal(claimed[0]?.eventId, eventId);
    assert.equal(claimed[0]?.attempts, 2);
    const persisted = await prisma.domainOutboxEvent.findUniqueOrThrow({
      where: { eventId },
    });
    assert.equal(persisted.status, "CLAIMED");
    assert.equal(persisted.lockedBy, "replacement_dispatcher");
    assert.equal(
      persisted.lockExpiresAt?.toISOString(),
      "2026-07-13T10:01:30.000Z",
    );
  },
);

dbTest(
  "F1-C integration: Redis outage leaves a durable FAILED row with backoff",
  async (t) => {
    const fixture = await createFixture(1);
    t.after(async () => cleanupFixture(fixture.tenantId));
    const repository = new OutboxRepository(prisma as never);
    const queue = {
      enqueueEvent: async () => {
        throw new Error("connect ECONNREFUSED redis://user:secret@127.0.0.1:1");
      },
    };
    const dispatcher = new OutboxDispatcherService(
      repository,
      queue as never,
      new MetricsService(),
    );

    const before = new Date();
    const result = await dispatcher.dispatchBatch();

    assert.deepEqual(result, { claimed: 1, published: 0, failed: 1 });
    const persisted = await prisma.domainOutboxEvent.findUniqueOrThrow({
      where: { eventId: fixture.eventIds[0] },
    });
    assert.equal(persisted.status, "FAILED");
    assert.equal(persisted.attempts, 1);
    assert.ok(persisted.nextAttemptAt.getTime() >= before.getTime() + 900);
    assert.equal(persisted.lockedBy, null);
    assert.equal(persisted.lockExpiresAt, null);
    assert.match(persisted.lastError ?? "", /redis:\/\/\*\*\*@127\.0\.0\.1:1/);
    assert.doesNotMatch(persisted.lastError ?? "", /secret/);
  },
);

dbTest(
  "F1-C integration: confirmed ingress marks PUBLISHED and clears the lease",
  async (t) => {
    const fixture = await createFixture(1);
    t.after(async () => cleanupFixture(fixture.tenantId));
    const repository = new OutboxRepository(prisma as never);
    const enqueued: string[] = [];
    const metrics = new MetricsService();
    const dispatcher = new OutboxDispatcherService(
      repository,
      {
        enqueueEvent: async ({ eventId }: { eventId: string }) => {
          enqueued.push(eventId);
        },
      } as never,
      metrics,
    );

    const result = await dispatcher.dispatchBatch();

    assert.deepEqual(result, { claimed: 1, published: 1, failed: 0 });
    assert.deepEqual(enqueued, [fixture.eventIds[0]]);
    const persisted = await prisma.domainOutboxEvent.findUniqueOrThrow({
      where: { eventId: fixture.eventIds[0] },
    });
    assert.equal(persisted.status, "PUBLISHED");
    assert.equal(persisted.attempts, 1);
    assert.ok(persisted.publishedAt instanceof Date);
    assert.equal(persisted.lockedAt, null);
    assert.equal(persisted.lockExpiresAt, null);
    assert.equal(persisted.lockedBy, null);
    assert.match(
      metrics.renderPrometheus(),
      /semse_outbox_publish_lag_seconds [0-9.]+/,
    );
  },
);

dbTest(
  "F1-C integration: exponential retry reaches durable DEAD_LETTER at maxAttempts",
  async (t) => {
    const fixture = await createFixture(1);
    t.after(async () => cleanupFixture(fixture.tenantId));
    const eventId = fixture.eventIds[0]!;
    await prisma.domainOutboxEvent.update({
      where: { eventId },
      data: {
        status: "FAILED",
        attempts: 4,
        maxAttempts: 5,
        nextAttemptAt: new Date(Date.now() - 1_000),
      },
    });
    const repository = new OutboxRepository(prisma as never);
    const metrics = new MetricsService();
    const dispatcher = new OutboxDispatcherService(
      repository,
      {
        enqueueEvent: async () => {
          throw new Error("Redis remains unavailable");
        },
      } as never,
      metrics,
    );

    const result = await dispatcher.dispatchBatch();

    assert.deepEqual(result, { claimed: 1, published: 0, failed: 1 });
    const persisted = await prisma.domainOutboxEvent.findUniqueOrThrow({
      where: { eventId },
    });
    assert.equal(persisted.status, "DEAD_LETTER");
    assert.equal(persisted.attempts, 5);
    assert.equal(persisted.lockedBy, null);
    assert.match(metrics.renderPrometheus(), /semse_event_dlq_total 1/);
  },
);
