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

async function createFixture(options: { payoutsEnabled?: boolean } = {}) {
  const tenantId = uniqueId("tenant_origin");
  const orgId = uniqueId("org_origin");
  const ownerUserId = uniqueId("usr_owner");
  const originatorUserId = uniqueId("usr_originator");

  await prisma.tenant.create({
    data: { id: tenantId, slug: uniqueId("slug"), name: `Tenant ${tenantId}`, status: "active" },
  });
  await prisma.org.create({ data: { id: orgId, tenantId, type: "client", name: "Originator Test Org" } });
  await prisma.user.createMany({
    data: [
      { id: ownerUserId, email: `${ownerUserId}@example.com`, status: "active" },
      { id: originatorUserId, email: `${originatorUserId}@example.com`, status: "active" },
    ],
  });
  const project = await prisma.buildOpsProject.create({
    data: {
      tenantId,
      orgId,
      createdBy: ownerUserId,
      title: "Originator test project",
      trade: "general",
      projectType: "renovation",
      clientName: "Test Client",
      location: "Miami, FL",
    },
  });

  if (options.payoutsEnabled !== undefined) {
    await prisma.stripeConnectAccount.create({
      data: {
        userId: originatorUserId,
        stripeAccountId: uniqueId("acct"),
        payoutsEnabled: options.payoutsEnabled,
        country: "US",
      },
    });
  }

  return { tenantId, orgId, ownerUserId, originatorUserId, projectId: project.id };
}

async function cleanupFixture(fixture: Awaited<ReturnType<typeof createFixture>>) {
  await prisma.originatorReward.deleteMany({
    where: { projectOriginatorId: { in: (await prisma.projectOriginator.findMany({ where: { tenantId: fixture.tenantId }, select: { id: true } })).map((r) => r.id) } },
  });
  await prisma.projectOriginator.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.domainOutboxEvent.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.stripeConnectAccount.deleteMany({ where: { userId: fixture.originatorUserId } });
  await prisma.buildOpsProject.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.org.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.tenant.deleteMany({ where: { id: fixture.tenantId } });
  await prisma.user.deleteMany({ where: { id: { in: [fixture.ownerUserId, fixture.originatorUserId] } } });
}

// T-010 — publicar sin actividad no genera recompensa: propose() por sí
// solo nunca crea un OriginatorReward, sólo el registro pendiente.
dbTest("T-010: proposing an originator alone creates no reward", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const service = makeService();

  const created = await service.propose({
    tenantId: fixture.tenantId,
    orgId: fixture.orgId,
    projectId: fixture.projectId,
    originatorUserId: fixture.originatorUserId,
    actorUserId: fixture.originatorUserId,
    requestId: uniqueId("req"),
  });

  assert.equal(created.status, "PENDING_OWNER_VALIDATION");
  const rewards = await service.listRewards(created.id);
  assert.equal(rewards.length, 0);

  const events = await prisma.domainOutboxEvent.findMany({ where: { tenantId: fixture.tenantId } });
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, "project.originator_proposed.v1");
});

// T-011 — rechazo del dueño bloquea toda recompensa futura.
dbTest("T-011: owner rejection blocks any future reward creation", async (t) => {
  const fixture = await createFixture({ payoutsEnabled: true });
  t.after(() => cleanupFixture(fixture));
  const service = makeService();

  const created = await service.propose({
    tenantId: fixture.tenantId,
    orgId: fixture.orgId,
    projectId: fixture.projectId,
    originatorUserId: fixture.originatorUserId,
    actorUserId: fixture.originatorUserId,
    requestId: uniqueId("req"),
  });

  const rejected = await service.validateForProject({
    tenantId: fixture.tenantId,
    orgId: fixture.orgId,
    projectId: fixture.projectId,
    actorUserId: fixture.ownerUserId,
    decision: "REJECTED",
    requestId: uniqueId("req"),
  });
  assert.equal(rejected.status, "REJECTED");

  await assert.rejects(
    () =>
      service.createRewardEvent({
        projectOriginatorId: created.id,
        type: "FIXED_BONUS",
        triggerEvent: "first_milestone_funded",
      }),
    /Rewards can only be created for a validated originator/,
  );
});

// T-012 — mismo originador en múltiples proyectos sin avance: no bloquea
// propose() (queda para risk scoring existente, no se inventa un bloqueo).
dbTest("T-012: same originator across multiple projects is not auto-blocked", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const service = makeService();

  const second = await prisma.buildOpsProject.create({
    data: {
      tenantId: fixture.tenantId,
      orgId: fixture.orgId,
      createdBy: fixture.ownerUserId,
      title: "Second project",
      trade: "general",
      projectType: "renovation",
      clientName: "Test Client 2",
      location: "Miami, FL",
    },
  });
  t.after(() => prisma.buildOpsProject.deleteMany({ where: { id: second.id } }));

  await service.propose({
    tenantId: fixture.tenantId,
    orgId: fixture.orgId,
    projectId: fixture.projectId,
    originatorUserId: fixture.originatorUserId,
    actorUserId: fixture.originatorUserId,
    requestId: uniqueId("req"),
  });
  const secondRegistration = await service.propose({
    tenantId: fixture.tenantId,
    orgId: fixture.orgId,
    projectId: second.id,
    originatorUserId: fixture.originatorUserId,
    actorUserId: fixture.originatorUserId,
    requestId: uniqueId("req"),
  });

  assert.equal(secondRegistration.status, "PENDING_OWNER_VALIDATION");
});

// T-013 — createRewardEvent con payoutsEnabled=true entra en PENDING_REVIEW
// con reviewEndsAt = ahora + 14 días.
dbTest("T-013: eligible originator's reward starts PENDING_REVIEW with a 14-day window", async (t) => {
  const fixture = await createFixture({ payoutsEnabled: true });
  t.after(() => cleanupFixture(fixture));
  const service = makeService();

  const created = await service.propose({
    tenantId: fixture.tenantId,
    orgId: fixture.orgId,
    projectId: fixture.projectId,
    originatorUserId: fixture.originatorUserId,
    actorUserId: fixture.originatorUserId,
    requestId: uniqueId("req"),
  });
  await service.validateForProject({
    tenantId: fixture.tenantId,
    orgId: fixture.orgId,
    projectId: fixture.projectId,
    actorUserId: fixture.ownerUserId,
    decision: "VALIDATED",
    requestId: uniqueId("req"),
  });

  const before = Date.now();
  const reward = await service.createRewardEvent({
    projectOriginatorId: created.id,
    type: "FIXED_BONUS",
    triggerEvent: "first_milestone_funded",
  });

  assert.equal(reward.status, "PENDING_REVIEW");
  assert.equal(reward.amountCents, 2500);
  const deltaMs = reward.reviewEndsAt.getTime() - before;
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  assert.ok(Math.abs(deltaMs - fourteenDaysMs) < 5000, `expected ~14 days, got ${deltaMs}ms`);
});

// T-015 — sin payoutsEnabled nace BLOCKED_NO_PAYOUT_ACCOUNT; pasa a
// PENDING_REVIEW (arrancando los 14 días) recién al completar onboarding.
// (T-014, release_failed en liberación real, es Fase 3 — no aplica aquí.)
dbTest("T-015: ineligible originator's reward is blocked, then unblocked on onboarding", async (t) => {
  const fixture = await createFixture({ payoutsEnabled: false });
  t.after(() => cleanupFixture(fixture));
  const service = makeService();

  const created = await service.propose({
    tenantId: fixture.tenantId,
    orgId: fixture.orgId,
    projectId: fixture.projectId,
    originatorUserId: fixture.originatorUserId,
    actorUserId: fixture.originatorUserId,
    requestId: uniqueId("req"),
  });
  await service.validateForProject({
    tenantId: fixture.tenantId,
    orgId: fixture.orgId,
    projectId: fixture.projectId,
    actorUserId: fixture.ownerUserId,
    decision: "VALIDATED",
    requestId: uniqueId("req"),
  });

  const reward = await service.createRewardEvent({
    projectOriginatorId: created.id,
    type: "FIXED_BONUS",
    triggerEvent: "first_milestone_funded",
  });
  assert.equal(reward.status, "BLOCKED_NO_PAYOUT_ACCOUNT");

  const unblockedCount = await service.unblockPendingRewards(fixture.originatorUserId);
  assert.equal(unblockedCount, 1);

  const [refreshed] = await service.listRewards(created.id);
  assert.equal(refreshed?.status, "PENDING_REVIEW");
  assert.ok(refreshed?.reviewEndsAt.getTime() > Date.now());
});

// T-017 — PLATFORM_FEE_SHARE calcula sobre platformFeeCents, nunca sobre el
// valor bruto; si es 0 (o negativo), el monto es 0, nunca negativo.
dbTest("T-017: platform fee share is computed on platformFeeCents and clamped at 0", async (t) => {
  const fixture = await createFixture({ payoutsEnabled: true });
  t.after(() => cleanupFixture(fixture));
  const service = makeService();

  const created = await service.propose({
    tenantId: fixture.tenantId,
    orgId: fixture.orgId,
    projectId: fixture.projectId,
    originatorUserId: fixture.originatorUserId,
    actorUserId: fixture.originatorUserId,
    requestId: uniqueId("req"),
  });
  await service.validateForProject({
    tenantId: fixture.tenantId,
    orgId: fixture.orgId,
    projectId: fixture.projectId,
    actorUserId: fixture.ownerUserId,
    decision: "VALIDATED",
    requestId: uniqueId("req"),
  });

  const normal = await service.createRewardEvent({
    projectOriginatorId: created.id,
    type: "PLATFORM_FEE_SHARE",
    triggerEvent: "project_completed",
    platformFeeCentsSnapshot: 10_000,
  });
  assert.equal(normal.amountCents, 3_000); // 30% of 10,000

  const zero = await service.createRewardEvent({
    projectOriginatorId: created.id,
    type: "PLATFORM_FEE_SHARE",
    triggerEvent: "project_completed",
    platformFeeCentsSnapshot: 0,
  });
  assert.equal(zero.amountCents, 0);

  const negative = await service.createRewardEvent({
    projectOriginatorId: created.id,
    type: "PLATFORM_FEE_SHARE",
    triggerEvent: "project_completed",
    platformFeeCentsSnapshot: -500,
  });
  assert.equal(negative.amountCents, 0);
});

// T-016 — país sin gate legal: no aplica todavía. Esta capa (Fase 1-2) no
// tiene lógica de país; StripeConnectAccount.country sólo entra en juego en
// Fase 3 (bloqueada por el gate legal, fuera de este incremento).
test.skip("T-016: country legal gate — not applicable until Fase 3 wires real payout release", () => {});

// Aislamiento de tenant: propose()/validateForProject() nunca cruzan tenantId.
dbTest("tenant isolation: validateForProject never resolves a registration from another tenant", async (t) => {
  const fixtureA = await createFixture();
  const fixtureB = await createFixture();
  t.after(() => Promise.all([cleanupFixture(fixtureA), cleanupFixture(fixtureB)]));
  const service = makeService();

  await service.propose({
    tenantId: fixtureA.tenantId,
    orgId: fixtureA.orgId,
    projectId: fixtureA.projectId,
    originatorUserId: fixtureA.originatorUserId,
    actorUserId: fixtureA.originatorUserId,
    requestId: uniqueId("req"),
  });

  await assert.rejects(
    () =>
      service.validateForProject({
        tenantId: fixtureB.tenantId,
        orgId: fixtureB.orgId,
        projectId: fixtureA.projectId,
        actorUserId: fixtureA.ownerUserId,
        decision: "VALIDATED",
        requestId: uniqueId("req"),
      }),
    /Originator registration not found/,
  );
});
