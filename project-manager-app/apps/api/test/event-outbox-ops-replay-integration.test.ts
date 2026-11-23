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


const isolatedOrgTest = (() => {
  const raw = process.env.DATABASE_URL;
  if (!raw) return test.skip;
  let url: URL;
  try { url = new URL(raw); } catch { return test.skip; }
  if (!["postgresql:", "postgres:"].includes(url.protocol)
      || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      || url.port !== "5433") return test.skip;
  const database = decodeURIComponent(url.pathname.slice(1));
  if (process.env.GITHUB_ACTIONS === "true")
    return process.env.CI === "true" && url.hostname === "127.0.0.1"
      && url.username === "semse" && database === "semse" ? test : test.skip;
  return process.env.SEMSE_ALLOW_DISPOSABLE_AGENT_CLAIM_DB === "1"
      && /^semse_(test|e2e)(?:_|$)/.test(database) ? test : test.skip;
})();

isolatedOrgTest(
  "#1156: outbox owner filters list, counts, delivery detail and replay inside one tenant",
  async (t) => {
    const tenantId = await createTenant();
    t.after(async () => cleanupTenant(tenantId));
    const repository = new OutboxRepository(prisma as never);
    const owned = await createOutboxEvent({ tenantId, status: "DEAD_LETTER" });
    const foreign = await createOutboxEvent({ tenantId, status: "DEAD_LETTER" });

    const ours = await repository.list({ tenantId, orgId: owned.orgId, limit: 50 });
    assert.deepEqual(ours.items.map(row => row.eventId), [owned.eventId]);
    const counts = await repository.countsByStatus(tenantId, owned.orgId);
    assert.equal(counts.DEAD_LETTER, 1);

    const denied = await repository.findDeliveryDetail({
      tenantId, orgId: foreign.orgId, eventId: owned.eventId,
    });
    assert.equal(denied, null, "foreign org receives no delivery metadata");
    assert.deepEqual(
      await repository.replay({ tenantId, orgId: foreign.orgId, eventId: owned.eventId }),
      { outcome: "not_found" },
    );
    const unchanged = await prisma.domainOutboxEvent.findUniqueOrThrow({ where: { eventId: owned.eventId } });
    assert.equal(unchanged.status, "DEAD_LETTER", "foreign org cannot mutate an event");

    const visible = await repository.findDeliveryDetail({
      tenantId, orgId: owned.orgId, eventId: owned.eventId,
    });
    assert.equal(visible?.eventId, owned.eventId);
    assert.deepEqual(
      await repository.replay({ tenantId, orgId: owned.orgId, eventId: owned.eventId }),
      { outcome: "replayed", replayCount: 1, status: "PENDING" },
    );
  },
);

isolatedOrgTest(
  "#1156: system-org project deliveries are visible and replayable only for the owning orgs",
  async (t) => {
    const tenantId = await createTenant();
    const orgA = uniqueId("org_a");
    const orgB = uniqueId("org_b");
    const jobA = uniqueId("job_a");
    const jobB = uniqueId("job_b");
    const projectA = uniqueId("project_a");
    const projectB = uniqueId("project_b");
    t.after(async () => {
      await prisma.domainEventConsumption.deleteMany({ where: { tenantId } });
      await prisma.domainOutboxEvent.deleteMany({ where: { tenantId } });
      await prisma.project.deleteMany({ where: { tenantId } });
      await prisma.job.deleteMany({ where: { tenantId } });
      await prisma.org.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    });

    await prisma.org.createMany({
      data: [
        { id: orgA, tenantId, type: "CLIENT", name: orgA },
        { id: orgB, tenantId, type: "PROFESSIONAL", name: orgB },
      ],
    });
    await prisma.job.create({
      data: { id: jobA, tenantId, clientOrgId: orgA, title: "A", scope: "A" },
    });
    await prisma.job.create({
      data: { id: jobB, tenantId, clientOrgId: orgB, title: "B", scope: "B" },
    });
    await prisma.project.create({
      data: { id: projectA, tenantId, jobId: jobA, assignedProOrgId: orgA },
    });
    await prisma.project.create({
      data: { id: projectB, tenantId, jobId: jobB, assignedProOrgId: orgB },
    });

    const systemOwned = await prisma.domainOutboxEvent.create({
      data: {
        eventType: "project.lifecycle-source-changed.v1",
        version: 1,
        envelopeVersion: 2,
        tenantId,
        orgId: "system",
        module: "projects",
        entityType: "Project",
        entityId: projectA,
        actorType: "system",
        actorId: "finance-service",
        correlationId: uniqueId("corr_sys_a"),
        idempotencyKey: uniqueId("idem_sys_a"),
        schemaRef: "project.lifecycle-source-changed.v1",
        payloadJson: { projectId: projectA },
        occurredAt: new Date(),
        status: "DEAD_LETTER",
        attempts: 5,
        maxAttempts: 5,
        lastError: "projection failed",
      },
    });
    const systemForeign = await prisma.domainOutboxEvent.create({
      data: {
        eventType: "project.lifecycle-source-changed.v1",
        version: 1,
        envelopeVersion: 2,
        tenantId,
        orgId: "system",
        module: "projects",
        entityType: "Project",
        entityId: projectB,
        actorType: "system",
        actorId: "finance-service",
        correlationId: uniqueId("corr_sys_b"),
        idempotencyKey: uniqueId("idem_sys_b"),
        schemaRef: "project.lifecycle-source-changed.v1",
        payloadJson: { projectId: projectB },
        occurredAt: new Date(),
        status: "DEAD_LETTER",
        attempts: 5,
        maxAttempts: 5,
        lastError: "projection failed",
      },
    });
    const systemUntied = await prisma.domainOutboxEvent.create({
      data: {
        eventType: "ops.internal.v1",
        version: 1,
        envelopeVersion: 2,
        tenantId,
        orgId: "system",
        module: "ops",
        entityType: "OpsJob",
        entityId: uniqueId("ops"),
        actorType: "system",
        actorId: "ops",
        correlationId: uniqueId("corr_untied"),
        idempotencyKey: uniqueId("idem_untied"),
        schemaRef: "ops.internal.v1",
        payloadJson: {},
        occurredAt: new Date(),
        status: "DEAD_LETTER",
        attempts: 5,
        maxAttempts: 5,
        lastError: "internal",
      },
    });
    const otherOrg = await createOutboxEvent({ tenantId, status: "DEAD_LETTER" });

    const repository = new OutboxRepository(prisma as never);
    const listed = await repository.list({ tenantId, orgId: orgA, limit: 50 });
    assert.deepEqual(listed.items.map((row) => row.eventId), [systemOwned.eventId]);

    const counts = await repository.countsByStatus(tenantId, orgA);
    assert.equal(counts.DEAD_LETTER, 1);

    assert.equal(
      (await repository.findDeliveryDetail({ tenantId, orgId: orgA, eventId: systemOwned.eventId }))?.eventId,
      systemOwned.eventId,
    );
    assert.equal(
      await repository.findDeliveryDetail({ tenantId, orgId: orgA, eventId: systemForeign.eventId }),
      null,
      "system delivery for another org's project stays hidden",
    );
    assert.equal(
      await repository.findDeliveryDetail({ tenantId, orgId: orgA, eventId: systemUntied.eventId }),
      null,
      "system delivery without a project tie stays hidden",
    );
    assert.equal(
      await repository.findDeliveryDetail({ tenantId, orgId: orgA, eventId: otherOrg.eventId }),
      null,
      "another org's own deliveries stay hidden",
    );

    assert.deepEqual(
      await repository.replay({ tenantId, orgId: orgA, eventId: systemForeign.eventId }),
      { outcome: "not_found" },
    );
    assert.deepEqual(
      await repository.replay({ tenantId, orgId: orgA, eventId: systemOwned.eventId }),
      { outcome: "replayed", replayCount: 1, status: "PENDING" },
    );
    const replayed = await prisma.domainOutboxEvent.findUniqueOrThrow({
      where: { eventId: systemOwned.eventId },
    });
    assert.equal(replayed.status, "PENDING");
    const foreignUnchanged = await prisma.domainOutboxEvent.findUniqueOrThrow({
      where: { eventId: systemForeign.eventId },
    });
    assert.equal(foreignUnchanged.status, "DEAD_LETTER");
  },
);
