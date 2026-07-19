import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
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

async function createTenant() {
  const tenantId = uniqueId("tenant_f1e");
  await prisma.tenant.create({
    data: { id: tenantId, slug: uniqueId("slug"), name: `Tenant ${tenantId}`, status: "active" },
  });
  return tenantId;
}

async function createOutboxEvent(input: {
  tenantId: string;
  status: "PENDING" | "CLAIMED" | "PUBLISHED" | "FAILED" | "DEAD_LETTER";
  attempts?: number;
}) {
  return prisma.domainOutboxEvent.create({
    data: {
      eventType: "evidence.uploaded.v1",
      version: 1,
      envelopeVersion: 2,
      tenantId: input.tenantId,
      orgId: uniqueId("org"),
      module: "evidence",
      entityType: "Evidence",
      entityId: uniqueId("evidence"),
      actorType: "user",
      actorId: uniqueId("usr"),
      correlationId: uniqueId("corr"),
      idempotencyKey: uniqueId("idem"),
      schemaRef: "evidence.uploaded.v1",
      payloadJson: { evidenceId: "evid_1" },
      occurredAt: new Date(),
      status: input.status,
      attempts: input.attempts ?? 5,
      maxAttempts: 5,
      lastError: input.status === "DEAD_LETTER" ? "redacted failure" : null,
    },
  });
}

async function cleanupTenant(tenantId: string) {
  await prisma.domainEventConsumption.deleteMany({ where: { tenantId } });
  await prisma.domainOutboxEvent.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
}

dbTest(
  "F1-E integration: outbox-level replay transitions DEAD_LETTER -> PENDING and increments replayCount",
  async (t) => {
    const tenantId = await createTenant();
    t.after(async () => cleanupTenant(tenantId));
    const repository = new OutboxRepository(prisma as never);
    const event = await createOutboxEvent({ tenantId, status: "DEAD_LETTER" });

    const result = await repository.replay({ eventId: event.eventId, tenantId });

    assert.deepEqual(result, { outcome: "replayed", replayCount: 1, status: "PENDING" });
    const reloaded = await prisma.domainOutboxEvent.findUniqueOrThrow({
      where: { eventId: event.eventId },
    });
    assert.equal(reloaded.status, "PENDING");
    assert.equal(reloaded.attempts, 0);
    assert.equal(reloaded.replayCount, 1);
  },
);

dbTest(
  "F1-E integration: replay is rejected (409-shaped conflict) unless the event is DEAD_LETTER",
  async (t) => {
    const tenantId = await createTenant();
    t.after(async () => cleanupTenant(tenantId));
    const repository = new OutboxRepository(prisma as never);
    const event = await createOutboxEvent({ tenantId, status: "PUBLISHED" });

    const result = await repository.replay({ eventId: event.eventId, tenantId });

    assert.deepEqual(result, { outcome: "conflict", status: "PUBLISHED" });
  },
);

dbTest(
  "F1-E integration: replay does not cross tenants",
  async (t) => {
    const tenantA = await createTenant();
    const tenantB = await createTenant();
    t.after(async () => {
      await cleanupTenant(tenantA);
      await cleanupTenant(tenantB);
    });
    const repository = new OutboxRepository(prisma as never);
    const event = await createOutboxEvent({ tenantId: tenantA, status: "DEAD_LETTER" });

    const result = await repository.replay({ eventId: event.eventId, tenantId: tenantB });

    assert.deepEqual(result, { outcome: "not_found" });
    const untouched = await prisma.domainOutboxEvent.findUniqueOrThrow({
      where: { eventId: event.eventId },
    });
    assert.equal(untouched.status, "DEAD_LETTER");
    assert.equal(untouched.replayCount, 0);
  },
);

dbTest(
  "F1-E integration: consumer-level replay resets only the targeted receipt and bumps the shared generation counter",
  async (t) => {
    const tenantId = await createTenant();
    t.after(async () => cleanupTenant(tenantId));
    const repository = new OutboxRepository(prisma as never);
    const event = await createOutboxEvent({ tenantId, status: "PUBLISHED", attempts: 1 });
    await prisma.domainEventConsumption.create({
      data: {
        eventId: event.eventId,
        tenantId,
        consumerName: "evidence-readiness.v1",
        status: "DEAD_LETTER",
        attempts: 5,
        maxAttempts: 5,
        lastError: "redacted consumer failure",
      },
    });

    const result = await repository.replay({
      eventId: event.eventId,
      tenantId,
      consumerName: "evidence-readiness.v1",
    });

    assert.deepEqual(result, { outcome: "replayed", replayCount: 1, status: "PENDING" });
    const receipt = await prisma.domainEventConsumption.findFirstOrThrow({
      where: { eventId: event.eventId, consumerName: "evidence-readiness.v1" },
    });
    assert.equal(receipt.status, "PENDING");
    assert.equal(receipt.attempts, 0);
    const reloadedEvent = await prisma.domainOutboxEvent.findUniqueOrThrow({
      where: { eventId: event.eventId },
    });
    assert.equal(reloadedEvent.status, "PUBLISHED", "outbox delivery state is untouched by a consumer-only replay");
    assert.equal(reloadedEvent.replayCount, 1);
  },
);

dbTest(
  "F1-E integration: list() and findDeliveryDetail() are tenant-scoped and omit payload",
  async (t) => {
    const tenantA = await createTenant();
    const tenantB = await createTenant();
    t.after(async () => {
      await cleanupTenant(tenantA);
      await cleanupTenant(tenantB);
    });
    const repository = new OutboxRepository(prisma as never);
    const eventA = await createOutboxEvent({ tenantId: tenantA, status: "DEAD_LETTER" });
    await createOutboxEvent({ tenantId: tenantB, status: "DEAD_LETTER" });

    const { items } = await repository.list({ tenantId: tenantA, limit: 50 });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.eventId, eventA.eventId);
    assert.equal((items[0] as unknown as { payloadJson?: unknown }).payloadJson, undefined);

    const detailFromOwnTenant = await repository.findDeliveryDetail({
      eventId: eventA.eventId,
      tenantId: tenantA,
    });
    assert.ok(detailFromOwnTenant);
    assert.equal((detailFromOwnTenant as unknown as { payloadJson?: unknown }).payloadJson, undefined);

    const detailFromOtherTenant = await repository.findDeliveryDetail({
      eventId: eventA.eventId,
      tenantId: tenantB,
    });
    assert.equal(detailFromOtherTenant, null);
  },
);
