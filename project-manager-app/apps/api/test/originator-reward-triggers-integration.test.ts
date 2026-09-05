import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { OutboxRepository } from "../dist/modules/domain-events/outbox.repository.js";
import { OriginatorRepository } from "../dist/modules/originator/originator.repository.js";
import { OriginatorService } from "../dist/modules/originator/originator.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");

loadEnv({ path: path.join(repoRoot, "packages/db/.env") });

const prisma = new PrismaClient();
const dbTest = process.env.DATABASE_URL ? test : test.skip;

function uniqueId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const fakeAudit = { async append() { /* not under test here */ } };

function makeService() {
  const repository = new OriginatorRepository(prisma as never, new OutboxRepository());
  return new OriginatorService(repository, prisma as never, fakeAudit as never);
}

async function createFixture() {
  const tenantId = uniqueId("tenant_trig");
  const clientOrgId = uniqueId("org_client");
  const proOrgId = uniqueId("org_pro");
  const ownerUserId = uniqueId("usr_owner");
  const originatorUserId = uniqueId("usr_originator");

  await prisma.tenant.create({
    data: { id: tenantId, slug: uniqueId("slug"), name: `Tenant ${tenantId}`, status: "active" },
  });
  await prisma.org.createMany({
    data: [
      { id: clientOrgId, tenantId, type: "client", name: "Trigger Test Client" },
      { id: proOrgId, tenantId, type: "pro", name: "Trigger Test Pro" },
    ],
  });
  await prisma.user.createMany({
    data: [
      { id: ownerUserId, email: `${ownerUserId}@example.com`, status: "active" },
      { id: originatorUserId, email: `${originatorUserId}@example.com`, status: "active" },
    ],
  });

  const job = await prisma.job.create({
    data: {
      tenantId,
      clientOrgId,
      title: "Trigger test job",
      scope: "Kitchen remodel",
    },
  });

  const buildOpsProject = await prisma.buildOpsProject.create({
    data: {
      tenantId,
      orgId: clientOrgId,
      createdBy: ownerUserId,
      title: "Trigger test plan",
      trade: "carpentry",
      projectType: "renovation",
      clientName: "Test Client",
      location: "Miami, FL",
      jobId: job.id,
    },
  });

  const executionProject = await prisma.project.create({
    data: { tenantId, jobId: job.id, assignedProOrgId: proOrgId, status: "OPEN" },
  });

  const escrow = await prisma.paymentEscrow.create({
    data: {
      projectId: executionProject.id,
      jobId: job.id,
      providerRef: uniqueId("escrow"),
      totalAmount: 10000,
    },
  });

  return {
    tenantId, clientOrgId, proOrgId, ownerUserId, originatorUserId,
    jobId: job.id, buildOpsProjectId: buildOpsProject.id,
    executionProjectId: executionProject.id, escrowId: escrow.id,
  };
}

async function cleanupFixture(fixture: Awaited<ReturnType<typeof createFixture>>) {
  const registrations = await prisma.projectOriginator.findMany({
    where: { tenantId: fixture.tenantId },
    select: { id: true },
  });
  await prisma.originatorReward.deleteMany({
    where: { projectOriginatorId: { in: registrations.map((r) => r.id) } },
  });
  await prisma.projectOriginator.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.domainOutboxEvent.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.paymentTxn.deleteMany({ where: { escrowId: fixture.escrowId } });
  await prisma.milestone.deleteMany({ where: { projectId: fixture.executionProjectId } });
  await prisma.paymentEscrow.deleteMany({ where: { id: fixture.escrowId } });
  await prisma.project.deleteMany({ where: { id: fixture.executionProjectId } });
  await prisma.buildOpsProject.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.job.deleteMany({ where: { id: fixture.jobId } });
  await prisma.org.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.tenant.deleteMany({ where: { id: fixture.tenantId } });
  await prisma.user.deleteMany({ where: { id: { in: [fixture.ownerUserId, fixture.originatorUserId] } } });
}

async function registerAndValidateOriginator(
  service: OriginatorService,
  fixture: Awaited<ReturnType<typeof createFixture>>,
) {
  await service.propose({
    tenantId: fixture.tenantId,
    orgId: fixture.clientOrgId,
    projectId: fixture.buildOpsProjectId,
    originatorUserId: fixture.originatorUserId,
    actorUserId: fixture.originatorUserId,
    requestId: uniqueId("req"),
  });
  await service.validateForProject({
    tenantId: fixture.tenantId,
    orgId: fixture.clientOrgId,
    projectId: fixture.buildOpsProjectId,
    actorUserId: fixture.ownerUserId,
    decision: "VALIDATED",
    requestId: uniqueId("req"),
  });
}

async function createMilestone(projectId: string, amount: number, sequence: number) {
  return prisma.milestone.create({
    data: { projectId, title: `Milestone ${sequence}`, amount, sequence },
  });
}

async function createDeposit(escrowId: string, amount: number) {
  return prisma.paymentTxn.create({
    data: { escrowId, type: "DEPOSIT", amount, providerRef: uniqueId("dep"), status: "SUCCEEDED" },
  });
}

async function createRelease(escrowId: string, amount: number) {
  return prisma.paymentTxn.create({
    data: { escrowId, type: "RELEASE", amount, providerRef: uniqueId("rel"), status: "SUCCEEDED" },
  });
}

dbTest("evaluateMilestoneFundedTrigger creates FIXED_BONUS once the first milestone is covered", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const service = makeService();

  await registerAndValidateOriginator(service, fixture);
  await createMilestone(fixture.executionProjectId, 2000, 1);
  await createDeposit(fixture.escrowId, 2000);

  await service.evaluateMilestoneFundedTrigger({
    tenantId: fixture.tenantId,
    orgId: fixture.clientOrgId,
    executionProjectId: fixture.executionProjectId,
    requestId: uniqueId("req"),
  });

  const projectOriginator = await prisma.projectOriginator.findUnique({ where: { projectId: fixture.buildOpsProjectId } });
  const rewards = await service.listRewards(projectOriginator!.id);
  assert.equal(rewards.length, 1);
  assert.equal(rewards[0]?.type, "FIXED_BONUS");
  assert.equal(rewards[0]?.amountCents, 2500);
});

dbTest("evaluateMilestoneFundedTrigger is a no-op when the deposit does not cover the first milestone", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const service = makeService();

  await registerAndValidateOriginator(service, fixture);
  await createMilestone(fixture.executionProjectId, 5000, 1);
  await createDeposit(fixture.escrowId, 1000);

  await service.evaluateMilestoneFundedTrigger({
    tenantId: fixture.tenantId,
    orgId: fixture.clientOrgId,
    executionProjectId: fixture.executionProjectId,
    requestId: uniqueId("req"),
  });

  const projectOriginator = await prisma.projectOriginator.findUnique({ where: { projectId: fixture.buildOpsProjectId } });
  const rewards = await service.listRewards(projectOriginator!.id);
  assert.equal(rewards.length, 0);
});

dbTest("evaluateMilestoneFundedTrigger does not duplicate the bonus on a second sufficient deposit", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const service = makeService();

  await registerAndValidateOriginator(service, fixture);
  await createMilestone(fixture.executionProjectId, 1000, 1);
  await createDeposit(fixture.escrowId, 1000);

  await service.evaluateMilestoneFundedTrigger({
    tenantId: fixture.tenantId, orgId: fixture.clientOrgId,
    executionProjectId: fixture.executionProjectId, requestId: uniqueId("req"),
  });

  // A second deposit (e.g. funding a later milestone) must not create a second FIXED_BONUS.
  await createDeposit(fixture.escrowId, 1000);
  await service.evaluateMilestoneFundedTrigger({
    tenantId: fixture.tenantId, orgId: fixture.clientOrgId,
    executionProjectId: fixture.executionProjectId, requestId: uniqueId("req"),
  });

  const projectOriginator = await prisma.projectOriginator.findUnique({ where: { projectId: fixture.buildOpsProjectId } });
  const rewards = await service.listRewards(projectOriginator!.id);
  assert.equal(rewards.filter((r) => r.type === "FIXED_BONUS").length, 1);
});

dbTest("evaluateProjectCompletedTrigger creates PLATFORM_FEE_SHARE from released funds", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const service = makeService();

  await registerAndValidateOriginator(service, fixture);
  await createRelease(fixture.escrowId, 10000);

  await service.evaluateProjectCompletedTrigger({
    tenantId: fixture.tenantId,
    orgId: fixture.clientOrgId,
    executionProjectId: fixture.executionProjectId,
    requestId: uniqueId("req"),
  });

  const projectOriginator = await prisma.projectOriginator.findUnique({ where: { projectId: fixture.buildOpsProjectId } });
  const rewards = await service.listRewards(projectOriginator!.id);
  assert.equal(rewards.length, 1);
  assert.equal(rewards[0]?.type, "PLATFORM_FEE_SHARE");
  // PaymentTxn.amount is decimal dollars (Decimal(12,2)), so released=10000
  // means $10,000. platformFeeCentsSnapshot = 10000 * PLATFORM_FEE_RATE(0.0075) * 100
  // = 7500 cents platform fee; 30% of that (PLATFORM_FEE_SHARE_RATE) = 2250
  // cents for the originator.
  assert.equal(rewards[0]?.platformFeeCentsSnapshot, 7500);
  assert.equal(rewards[0]?.amountCents, 2250);
});

dbTest("both triggers no-op silently when there is no validated originator", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const service = makeService();

  await createMilestone(fixture.executionProjectId, 100, 1);
  await createDeposit(fixture.escrowId, 100);
  await createRelease(fixture.escrowId, 100);

  await service.evaluateMilestoneFundedTrigger({
    tenantId: fixture.tenantId, orgId: fixture.clientOrgId,
    executionProjectId: fixture.executionProjectId, requestId: uniqueId("req"),
  });
  await service.evaluateProjectCompletedTrigger({
    tenantId: fixture.tenantId, orgId: fixture.clientOrgId,
    executionProjectId: fixture.executionProjectId, requestId: uniqueId("req"),
  });

  // No ProjectOriginator exists for this tenant, and OriginatorReward always
  // requires a valid projectOriginatorId FK — so no reward could have been
  // created for this fixture regardless of the deposit/release amounts above.
  const registrations = await prisma.projectOriginator.count({ where: { tenantId: fixture.tenantId } });
  assert.equal(registrations, 0);
});
