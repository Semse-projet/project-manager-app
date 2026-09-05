import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { BuildOpsService } from "../dist/modules/buildops/buildops.service.js";
import { JobsService } from "../dist/modules/jobs/jobs.service.js";
import { JobsRepository } from "../dist/modules/jobs/jobs.repository.js";
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

const fakeActorContext = { async ensureActorContext() { /* not under test here */ } };
const fakeAudit = { async append() { /* not under test here */ } };
const fakeDomainEventBus = { async emit() { /* not under test here */ } };
const fakeWorkspaceMemory = { async append() { /* not under test here */ } };

function makeService() {
  const jobsRepository = new JobsRepository(
    prisma as never,
    fakeActorContext as never,
    new OutboxRepository(prisma as never) as never,
  );
  const jobsService = new JobsService(
    jobsRepository as never,
    fakeAudit as never,
    fakeDomainEventBus as never,
    fakeWorkspaceMemory as never,
    prisma as never,
    undefined,
  );
  return new BuildOpsService(prisma as never, jobsService as never);
}

async function createFixture() {
  const tenantId = uniqueId("tenant_publish");
  const orgId = uniqueId("org_publish");
  const userId = uniqueId("usr_publish");

  await prisma.tenant.create({
    data: { id: tenantId, slug: uniqueId("slug"), name: `Tenant ${tenantId}`, status: "active" },
  });
  await prisma.org.create({ data: { id: orgId, tenantId, type: "client", name: "Publish Test Org" } });
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.com`, status: "active" } });

  return { tenantId, orgId, userId };
}

async function cleanupFixture(fixture: Awaited<ReturnType<typeof createFixture>>) {
  await prisma.buildOpsProject.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.job.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.org.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.tenant.deleteMany({ where: { id: fixture.tenantId } });
  await prisma.user.deleteMany({ where: { id: fixture.userId } });
}

async function createDraftProject(fixture: Awaited<ReturnType<typeof createFixture>>, overrides: Record<string, unknown> = {}) {
  return prisma.buildOpsProject.create({
    data: {
      tenantId: fixture.tenantId,
      orgId: fixture.orgId,
      createdBy: fixture.userId,
      title: "Kitchen remodel estimate",
      description: "Full kitchen remodel, cabinets and countertops",
      trade: "carpentry",
      projectType: "renovation",
      clientName: "Test Client",
      location: "Miami, FL",
      budgetEstimate: 15000,
      ...overrides,
    },
  });
}

dbTest("publishing a draft creates a Job with mapped fields and sets jobId", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const service = makeService();

  const draft = await createDraftProject(fixture);
  assert.equal(draft.jobId, null);

  const result = await service.publishAsJob({
    tenantId: fixture.tenantId,
    orgId: fixture.orgId,
    userId: fixture.userId,
    buildOpsProjectId: draft.id,
    requestId: uniqueId("req"),
  });

  assert.equal(result.job.title, "Kitchen remodel estimate");
  assert.equal(result.job.category, "carpentry");
  assert.equal(result.job.scope, "Full kitchen remodel, cabinets and countertops");
  assert.equal(Number(result.job.budgetMin), 15000);
  assert.equal(Number(result.job.budgetMax), 15000);

  const persisted = await prisma.buildOpsProject.findUnique({ where: { id: draft.id } });
  assert.equal(persisted?.jobId, result.job.id);

  const job = await prisma.job.findUnique({ where: { id: result.job.id } });
  assert.equal(job?.tenantId, fixture.tenantId);
  assert.equal(job?.clientOrgId, fixture.orgId);
});

dbTest("publishing an already-published project fails with a conflict", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const service = makeService();

  const draft = await createDraftProject(fixture);
  await service.publishAsJob({
    tenantId: fixture.tenantId,
    orgId: fixture.orgId,
    userId: fixture.userId,
    buildOpsProjectId: draft.id,
    requestId: uniqueId("req"),
  });

  await assert.rejects(
    () =>
      service.publishAsJob({
        tenantId: fixture.tenantId,
        orgId: fixture.orgId,
        userId: fixture.userId,
        buildOpsProjectId: draft.id,
        requestId: uniqueId("req"),
      }),
    /already been published/,
  );
});

dbTest("publishing a project from another tenant is not found", async (t) => {
  const fixtureA = await createFixture();
  const fixtureB = await createFixture();
  t.after(() => Promise.all([cleanupFixture(fixtureA), cleanupFixture(fixtureB)]));
  const service = makeService();

  const draft = await createDraftProject(fixtureA);

  await assert.rejects(
    () =>
      service.publishAsJob({
        tenantId: fixtureB.tenantId,
        orgId: fixtureB.orgId,
        userId: fixtureB.userId,
        buildOpsProjectId: draft.id,
        requestId: uniqueId("req"),
      }),
    /not found/,
  );
});

dbTest("publishing a draft with no budget estimate creates a Job without budget bounds", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const service = makeService();

  const draft = await createDraftProject(fixture, { budgetEstimate: null });
  const result = await service.publishAsJob({
    tenantId: fixture.tenantId,
    orgId: fixture.orgId,
    userId: fixture.userId,
    buildOpsProjectId: draft.id,
    requestId: uniqueId("req"),
  });

  assert.equal(result.job.budgetMin == null, true);
  assert.equal(result.job.budgetMax == null, true);
});
