import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

import { MetricsService } from "../dist/infrastructure/observability/metrics.service.js";
import {
  DomainEventConsumerService,
  PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
} from "../dist/modules/domain-events/domain-event-consumer.service.js";
import { OutboxRepository } from "../dist/modules/domain-events/outbox.repository.js";
import { ProjectsRepository } from "../dist/modules/projects/projects.repository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
loadEnv({ path: path.join(repoRoot, "packages/db/.env") });

const prisma = new PrismaClient();
const dbTest = process.env.DATABASE_URL ? test : test.skip;
const previousEnvironment = {
  enabled: process.env.SEMSE_EVENT_CONSUMERS_ENABLED,
  consumers: process.env.SEMSE_EVENT_CONSUMER_ALLOWLIST,
  types: process.env.SEMSE_EVENT_TYPE_ALLOWLIST,
};

process.env.SEMSE_EVENT_CONSUMERS_ENABLED = "true";
process.env.SEMSE_EVENT_CONSUMER_ALLOWLIST =
  PROJECT_LIFECYCLE_PROJECTION_CONSUMER;
process.env.SEMSE_EVENT_TYPE_ALLOWLIST =
  "project.lifecycle-source-changed.v1";

test.after(async () => {
  await prisma.$disconnect();
  restore("SEMSE_EVENT_CONSUMERS_ENABLED", previousEnvironment.enabled);
  restore("SEMSE_EVENT_CONSUMER_ALLOWLIST", previousEnvironment.consumers);
  restore("SEMSE_EVENT_TYPE_ALLOWLIST", previousEnvironment.types);
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function uniqueId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

dbTest(
  "F3 integration: rebuild, duplicate delivery and consumer replay are idempotent",
  async (t) => {
    const tenantId = uniqueId("tenant_f3");
    const orgId = uniqueId("org_f3");
    const userId = uniqueId("user_f3");
    const jobId = uniqueId("job_f3");
    const projectId = uniqueId("project_f3");
    const eventId = randomUUID();
    const now = new Date();

    t.after(async () => {
      await prisma.domainEventConsumption.deleteMany({ where: { tenantId } });
      await prisma.auditLog.deleteMany({ where: { tenantId } });
      await prisma.domainOutboxEvent.deleteMany({ where: { tenantId } });
      await prisma.projectLifecycleProjection.deleteMany({ where: { tenantId } });
      await prisma.project.deleteMany({ where: { id: projectId } });
      await prisma.job.deleteMany({ where: { id: jobId } });
      await prisma.org.deleteMany({ where: { id: orgId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    });

    await prisma.tenant.create({
      data: { id: tenantId, slug: uniqueId("slug_f3"), name: tenantId },
    });
    await prisma.org.create({
      data: { id: orgId, tenantId, type: "CLIENT", name: orgId },
    });
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.test` },
    });
    await prisma.job.create({
      data: {
        id: jobId,
        tenantId,
        clientOrgId: orgId,
        title: "F3 lifecycle rebuild",
        scope: "Projection replay",
      },
    });
    await prisma.project.create({
      data: {
        id: projectId,
        tenantId,
        jobId,
        assignedProOrgId: orgId,
      },
    });
    await prisma.domainOutboxEvent.create({
      data: {
        eventId,
        eventType: "project.lifecycle-source-changed.v1",
        version: 1,
        envelopeVersion: 2,
        tenantId,
        orgId,
        module: "projects",
        entityType: "Project",
        entityId: projectId,
        actorType: "system",
        actorId: "f3-integration",
        correlationId: `correlation:${eventId}`,
        idempotencyKey: `project-lifecycle-source:test:${eventId}`,
        schemaRef:
          "semse://schemas/events/project.lifecycle-source-changed.v1",
        payloadJson: {
          projectId,
          sourceEventType: "project.fixture.created",
          sourceEntityType: "Project",
          sourceEntityId: projectId,
        },
        occurredAt: now,
        recordedAt: now,
        status: "PUBLISHED",
        publishedAt: now,
      },
    });

    const projectsRepository = new ProjectsRepository(
      prisma as never,
      {} as never,
    );
    const consumer = new DomainEventConsumerService(
      prisma as never,
      new MetricsService(),
      projectsRepository,
    );

    const first = await consumer.process(eventId, { workerId: "worker_f3" });
    const duplicate = await consumer.process(eventId, {
      workerId: "worker_f3",
    });
    assert.equal(first.effect, "updated");
    assert.equal(duplicate.duplicate, true);
    assert.equal(
      await prisma.projectLifecycleProjection.count({
        where: { tenantId, projectId },
      }),
      1,
    );

    await prisma.domainEventConsumption.update({
      where: {
        eventId_consumerName: {
          eventId,
          consumerName: PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
        },
      },
      data: {
        status: "DEAD_LETTER",
        attempts: 5,
        completedAt: null,
        resultJson: undefined,
      },
    });
    const replay = await new OutboxRepository(prisma as never).replay({
      eventId,
      tenantId,
      consumerName: PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
    });
    assert.deepEqual(replay, {
      outcome: "replayed",
      replayCount: 1,
      status: "PENDING",
    });

    const replayed = await consumer.process(eventId, {
      workerId: "worker_f3",
    });
    assert.equal(replayed.effect, "no_op");
    const receipt = await prisma.domainEventConsumption.findUniqueOrThrow({
      where: {
        eventId_consumerName: {
          eventId,
          consumerName: PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
        },
      },
    });
    assert.equal(receipt.status, "COMPLETED");
    assert.equal(receipt.attempts, 1);
    assert.equal(
      (
        await prisma.domainOutboxEvent.findUniqueOrThrow({
          where: { eventId },
        })
      ).replayCount,
      1,
    );
  },
);
