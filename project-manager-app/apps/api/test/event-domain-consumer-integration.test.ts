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
  EVIDENCE_READINESS_CONSUMER,
} from "../dist/modules/domain-events/domain-event-consumer.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");

loadEnv({ path: path.join(repoRoot, "packages/db/.env") });

const prisma = new PrismaClient();
const dbTest = process.env.DATABASE_URL ? test : test.skip;
const previousConsumerEnvironment = {
  enabled: process.env.SEMSE_EVENT_CONSUMERS_ENABLED,
  consumers: process.env.SEMSE_EVENT_CONSUMER_ALLOWLIST,
  eventTypes: process.env.SEMSE_EVENT_TYPE_ALLOWLIST,
};

process.env.SEMSE_EVENT_CONSUMERS_ENABLED = "true";
process.env.SEMSE_EVENT_CONSUMER_ALLOWLIST = EVIDENCE_READINESS_CONSUMER;
process.env.SEMSE_EVENT_TYPE_ALLOWLIST = "evidence.uploaded.v1";

test.after(async () => {
  await prisma.$disconnect();
  restoreEnvironment("SEMSE_EVENT_CONSUMERS_ENABLED", previousConsumerEnvironment.enabled);
  restoreEnvironment("SEMSE_EVENT_CONSUMER_ALLOWLIST", previousConsumerEnvironment.consumers);
  restoreEnvironment("SEMSE_EVENT_TYPE_ALLOWLIST", previousConsumerEnvironment.eventTypes);
});

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function uniqueId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function createFixture(input: { milestoneId?: string | null } = {}) {
  const tenantId = uniqueId("tenant_f1d");
  const orgId = uniqueId("org_f1d");
  const userId = uniqueId("user_f1d");
  const jobId = uniqueId("job_f1d");
  const projectId = uniqueId("project_f1d");
  const milestoneId = input.milestoneId === null
    ? null
    : input.milestoneId ?? uniqueId("milestone_f1d");
  const evidenceId = uniqueId("evidence_f1d");
  const eventId = randomUUID();

  await prisma.tenant.create({
    data: { id: tenantId, slug: uniqueId("slug_f1d"), name: tenantId },
  });
  await prisma.org.create({
    data: { id: orgId, tenantId, type: "PRO", name: orgId },
  });
  await prisma.user.create({
    data: { id: userId, email: `${userId}@example.test` },
  });
  await prisma.job.create({
    data: {
      id: jobId,
      tenantId,
      clientOrgId: orgId,
      title: "F1-D integration",
      scope: "Consumer atomicity",
    },
  });
  await prisma.project.create({
    data: { id: projectId, tenantId, jobId, assignedProOrgId: orgId },
  });
  const persistentMilestoneId = milestoneId ?? uniqueId("untouched_milestone_f1d");
  await prisma.milestone.create({
    data: {
      id: persistentMilestoneId,
      projectId,
      title: "Evidence gate",
      amount: 100,
      sequence: 1,
      requiredEvidenceTypes: ["PHOTO", "VIDEO"],
      evidenceReadiness: "missing",
      paymentReadiness: "not_ready",
    },
  });
  await prisma.evidence.create({
    data: {
      id: evidenceId,
      tenantId,
      projectId,
      milestoneId,
      uploadedById: userId,
      kind: "PHOTO",
      bucketKey: `tenants/${tenantId}/evidence/${evidenceId}.jpg`,
    },
  });
  await prisma.domainOutboxEvent.create({
    data: {
      eventId,
      eventType: "evidence.uploaded.v1",
      version: 1,
      envelopeVersion: 2,
      tenantId,
      orgId,
      module: "evidence",
      entityType: "Evidence",
      entityId: evidenceId,
      actorType: "user",
      actorId: userId,
      correlationId: `correlation:${eventId}`,
      idempotencyKey: `evidence.uploaded.v1:${evidenceId}`,
      schemaRef: "semse://schemas/events/evidence.uploaded.v1",
      payloadJson: {
        evidenceId,
        projectId,
        jobId,
        ...(milestoneId ? { milestoneId } : {}),
        uploaderId: userId,
        kind: "PHOTO",
        bucketKey: `tenants/${tenantId}/evidence/${evidenceId}.jpg`,
      },
      occurredAt: new Date(),
    },
  });

  return {
    tenantId,
    orgId,
    userId,
    jobId,
    projectId,
    milestoneId: persistentMilestoneId,
    eventMilestoneId: milestoneId,
    evidenceId,
    eventId,
  };
}

async function cleanupFixture(fixture: Awaited<ReturnType<typeof createFixture>>) {
  await prisma.domainEventConsumption.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.auditLog.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.domainOutboxEvent.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.evidence.deleteMany({ where: { projectId: fixture.projectId } });
  await prisma.milestone.deleteMany({ where: { projectId: fixture.projectId } });
  await prisma.project.deleteMany({ where: { id: fixture.projectId } });
  await prisma.job.deleteMany({ where: { id: fixture.jobId } });
  await prisma.org.deleteMany({ where: { id: fixture.orgId } });
  await prisma.tenant.deleteMany({ where: { id: fixture.tenantId } });
  await prisma.user.deleteMany({ where: { id: fixture.userId } });
}

dbTest("F1-D integration: concurrent duplicate delivery applies one atomic effect", async (t) => {
  const fixture = await createFixture();
  t.after(async () => cleanupFixture(fixture));
  const metrics = new MetricsService();
  const consumer = new DomainEventConsumerService(prisma as never, metrics);

  const results = await Promise.all([
    consumer.process(fixture.eventId),
    consumer.process(fixture.eventId),
  ]);

  assert.equal(results.filter((result) => result.duplicate).length, 1);
  assert.equal(results.filter((result) => !result.duplicate).length, 1);
  const milestone = await prisma.milestone.findUniqueOrThrow({
    where: { id: fixture.milestoneId },
  });
  assert.equal(milestone.evidenceReadiness, "partial");
  assert.equal(milestone.status, "DRAFT");
  assert.equal(milestone.paymentReadiness, "not_ready");
  const receipts = await prisma.domainEventConsumption.findMany({
    where: { eventId: fixture.eventId, consumerName: EVIDENCE_READINESS_CONSUMER },
  });
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0]?.status, "COMPLETED");
  assert.equal(receipts[0]?.attempts, 1);
  assert.equal(
    await prisma.auditLog.count({
      where: {
        tenantId: fixture.tenantId,
        action: "domain_event.consumer.evidence_readiness.updated",
      },
    }),
    1,
  );
});

dbTest("F1-D integration: evidence without milestone is an idempotent no-op", async (t) => {
  const fixture = await createFixture({ milestoneId: null });
  t.after(async () => cleanupFixture(fixture));
  const consumer = new DomainEventConsumerService(prisma as never, new MetricsService());

  const first = await consumer.process(fixture.eventId);
  const second = await consumer.process(fixture.eventId);

  assert.equal(first.effect, "no_op");
  assert.equal(first.milestoneId, null);
  assert.equal(second.duplicate, true);
  const milestone = await prisma.milestone.findUniqueOrThrow({
    where: { id: fixture.milestoneId },
  });
  assert.equal(milestone.evidenceReadiness, "missing");
  assert.equal(milestone.status, "DRAFT");
  assert.equal(milestone.paymentReadiness, "not_ready");
  assert.equal(
    await prisma.auditLog.count({
      where: {
        tenantId: fixture.tenantId,
        action: "domain_event.consumer.evidence_readiness.no_op",
      },
    }),
    1,
  );
});

dbTest("F1-D integration: transaction crash rolls back effect and a retry completes", async (t) => {
  const fixture = await createFixture();
  t.after(async () => cleanupFixture(fixture));
  const crashingPrisma = prisma.$extends({
    query: {
      auditLog: {
        create() {
          throw new Error("simulated crash before receipt commit");
        },
      },
    },
  });
  const crashingConsumer = new DomainEventConsumerService(
    crashingPrisma as never,
    new MetricsService(),
  );

  await assert.rejects(() => crashingConsumer.process(fixture.eventId), /retry is allowed/i);
  let milestone = await prisma.milestone.findUniqueOrThrow({
    where: { id: fixture.milestoneId },
  });
  assert.equal(milestone.evidenceReadiness, "missing");
  let receipt = await prisma.domainEventConsumption.findUniqueOrThrow({
    where: {
      eventId_consumerName: {
        eventId: fixture.eventId,
        consumerName: EVIDENCE_READINESS_CONSUMER,
      },
    },
  });
  assert.equal(receipt.status, "FAILED");
  assert.equal(receipt.attempts, 1);

  const consumer = new DomainEventConsumerService(prisma as never, new MetricsService());
  const result = await consumer.process(fixture.eventId);
  assert.equal(result.status, "completed");
  milestone = await prisma.milestone.findUniqueOrThrow({
    where: { id: fixture.milestoneId },
  });
  assert.equal(milestone.evidenceReadiness, "partial");
  receipt = await prisma.domainEventConsumption.findUniqueOrThrow({
    where: {
      eventId_consumerName: {
        eventId: fixture.eventId,
        consumerName: EVIDENCE_READINESS_CONSUMER,
      },
    },
  });
  assert.equal(receipt.status, "COMPLETED");
  assert.equal(receipt.attempts, 2);
});

dbTest("F1-D integration: repeated crashes reach durable consumer dead letter", async (t) => {
  const fixture = await createFixture();
  t.after(async () => cleanupFixture(fixture));
  const metrics = new MetricsService();
  const crashingPrisma = prisma.$extends({
    query: {
      auditLog: {
        create() {
          throw new Error("persistent simulated consumer crash");
        },
      },
    },
  });
  const consumer = new DomainEventConsumerService(crashingPrisma as never, metrics);

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await assert.rejects(() => consumer.process(fixture.eventId), /retry is allowed/i);
  }
  await assert.rejects(() => consumer.process(fixture.eventId), /dead letter/i);

  const receipt = await prisma.domainEventConsumption.findUniqueOrThrow({
    where: {
      eventId_consumerName: {
        eventId: fixture.eventId,
        consumerName: EVIDENCE_READINESS_CONSUMER,
      },
    },
  });
  assert.equal(receipt.status, "DEAD_LETTER");
  assert.equal(receipt.attempts, 5);
  const milestone = await prisma.milestone.findUniqueOrThrow({
    where: { id: fixture.milestoneId },
  });
  assert.equal(milestone.evidenceReadiness, "missing");
  assert.match(
    metrics.renderPrometheus(),
    /semse_event_consumer_dead_letter_total\{consumer="evidence-readiness\.v1"\} 1/,
  );
});
