import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { OutboxRepository } from "../dist/modules/domain-events/outbox.repository.js";
import { EvidenceRepository } from "../dist/modules/evidence/evidence.repository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");

loadEnv({ path: path.join(repoRoot, "packages/db/.env") });

const prisma = new PrismaClient();
const dbTest = process.env.DATABASE_URL ? test : test.skip;

function uniqueId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function createFixture() {
  const tenantId = uniqueId("tenant_f1b");
  const clientOrgId = uniqueId("org_client");
  const proOrgId = uniqueId("org_pro");
  const clientUserId = uniqueId("usr_client");
  const proUserId = uniqueId("usr_pro");
  const jobId = uniqueId("job_f1b");

  await prisma.tenant.create({
    data: {
      id: tenantId,
      slug: uniqueId("slug"),
      name: `Tenant ${tenantId}`,
      status: "active",
    },
  });
  await prisma.org.createMany({
    data: [
      { id: clientOrgId, tenantId, type: "client", name: "F1B Client" },
      { id: proOrgId, tenantId, type: "pro", name: "F1B Pro" },
    ],
  });
  await prisma.user.createMany({
    data: [
      {
        id: clientUserId,
        email: `${clientUserId}@example.com`,
        status: "active",
      },
      {
        id: proUserId,
        email: `${proUserId}@example.com`,
        status: "active",
      },
    ],
  });
  await prisma.job.create({
    data: {
      id: jobId,
      tenantId,
      clientOrgId,
      title: "F1B atomic evidence",
      category: "painting",
      scope: "Verify state and outbox atomicity.",
      status: "ACCEPTED",
      location: "Miami, FL",
      urgency: "medium",
    },
  });
  const project = await prisma.project.create({
    data: { tenantId, jobId, assignedProOrgId: proOrgId, status: "OPEN" },
  });

  return {
    tenantId,
    clientOrgId,
    proOrgId,
    clientUserId,
    proUserId,
    jobId,
    projectId: project.id,
  };
}

async function cleanupFixture(
  fixture: Awaited<ReturnType<typeof createFixture>>,
) {
  await prisma.domainEventConsumption.deleteMany({
    where: { tenantId: fixture.tenantId },
  });
  await prisma.domainOutboxEvent.deleteMany({
    where: { tenantId: fixture.tenantId },
  });
  await prisma.evidence.deleteMany({ where: { projectId: fixture.projectId } });
  await prisma.project.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.job.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.org.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.tenant.deleteMany({ where: { id: fixture.tenantId } });
  await prisma.user.deleteMany({
    where: { id: { in: [fixture.clientUserId, fixture.proUserId] } },
  });
}

function makeRepository(
  outboxRepository: OutboxRepository = new OutboxRepository(),
) {
  return new EvidenceRepository(
    prisma as never,
    { ensureActorContext: async () => undefined } as never,
    outboxRepository,
  );
}

dbTest(
  "F1-B integration: duplicate concurrent commands create one Evidence and one outbox row",
  async (t) => {
    const fixture = await createFixture();
    t.after(async () => cleanupFixture(fixture));
    const repository = makeRepository();
    const input = {
      tenantId: fixture.tenantId,
      orgId: fixture.proOrgId,
      userId: fixture.proUserId,
      roles: ["PRO"],
      requestId: uniqueId("request"),
      projectId: fixture.projectId,
      key: `tenants/${fixture.tenantId}/evidence/f1b-photo.jpg`,
      kind: "PHOTO" as const,
    };

    const [first, second] = await Promise.all([
      repository.create(input),
      repository.create(input),
    ]);

    assert.equal(first.id, second.id);
    assert.equal(
      await prisma.evidence.count({ where: { projectId: fixture.projectId } }),
      1,
    );
    const events = await prisma.domainOutboxEvent.findMany({
      where: { tenantId: fixture.tenantId },
    });
    assert.equal(events.length, 1);
    assert.equal(events[0]?.entityId, first.id);
    assert.equal(events[0]?.eventType, "evidence.uploaded.v1");
    assert.equal(events[0]?.status, "PENDING");
  },
);

dbTest(
  "F1-B integration: outbox failure rolls back the real Evidence row",
  async (t) => {
    const fixture = await createFixture();
    t.after(async () => cleanupFixture(fixture));
    const failingOutbox = {
      create: async () => {
        throw new Error("forced outbox failure");
      },
    } as OutboxRepository;
    const repository = makeRepository(failingOutbox);

    await assert.rejects(
      repository.create({
        tenantId: fixture.tenantId,
        orgId: fixture.proOrgId,
        userId: fixture.proUserId,
        roles: ["PRO"],
        requestId: uniqueId("request"),
        projectId: fixture.projectId,
        key: `tenants/${fixture.tenantId}/evidence/failing-photo.jpg`,
        kind: "PHOTO",
      }),
      /forced outbox failure/,
    );

    assert.equal(
      await prisma.evidence.count({ where: { projectId: fixture.projectId } }),
      0,
    );
    assert.equal(
      await prisma.domainOutboxEvent.count({
        where: { tenantId: fixture.tenantId },
      }),
      0,
    );
  },
);

dbTest(
  "F1-B integration: requestId reuse with different command data is rejected",
  async (t) => {
    const fixture = await createFixture();
    t.after(async () => cleanupFixture(fixture));
    const repository = makeRepository();
    const requestId = uniqueId("request");
    const baseInput = {
      tenantId: fixture.tenantId,
      orgId: fixture.proOrgId,
      userId: fixture.proUserId,
      roles: ["PRO"],
      requestId,
      projectId: fixture.projectId,
      key: `tenants/${fixture.tenantId}/evidence/original.jpg`,
      kind: "PHOTO" as const,
    };

    await repository.create(baseInput);
    await assert.rejects(
      repository.create({
        ...baseInput,
        key: `tenants/${fixture.tenantId}/evidence/different.jpg`,
      }),
      /requestId is already bound to a different Evidence command/,
    );

    assert.equal(
      await prisma.evidence.count({ where: { projectId: fixture.projectId } }),
      1,
    );
    assert.equal(
      await prisma.domainOutboxEvent.count({
        where: { tenantId: fixture.tenantId },
      }),
      1,
    );
  },
);
