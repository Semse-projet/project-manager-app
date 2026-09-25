import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { ContributorProgramRepository } from "../dist/modules/contributor-program/contributor-program.repository.js";
import { ContributorProgramService } from "../dist/modules/contributor-program/contributor-program.service.js";

// Knowledge Registry (PR-8) — docs/specs/core/knowledge-contributor-registry.spec.md.
// Split into its own file (same rationale as contributor-program-extraction.test.ts):
// the fixture here needs several missions/observations across trades/categories/
// promotion states, which would bloat contributor-program.service.test.ts.

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
const fakeStorage = { publicUrl: (key: string) => `https://storage.test/v1/uploads/files/${key}` };
// PR-9: this file's tests create Observation rows directly via Prisma
// (bypassing service.promoteObservation), so ingestText/deleteDocument are
// never invoked — present only so the constructor is satisfied.
const fakePrometeo = {
  async ingestText() {
    throw new Error("fakePrometeo.ingestText should not be called from this test file");
  },
  async deleteDocument() {
    throw new Error("fakePrometeo.deleteDocument should not be called from this test file");
  }
};
// PR-12: this file's tests never call processPendingExtractions — present
// only so the constructor is satisfied.
const fakeAiGateway = {
  async generate() {
    throw new Error("fakeAiGateway.generate should not be called from this test file");
  }
};

function makeService() {
  const repository = new ContributorProgramRepository(prisma as never);
  return {
    service: new ContributorProgramService(repository as never, fakeAudit as never, fakeStorage as never, fakePrometeo as never, fakeAiGateway as never),
    repository
  };
}

async function createTenant(prefix: string) {
  const tenantId = uniqueId(`tenant_${prefix}`);
  const orgId = uniqueId(`org_${prefix}`);
  const adminUserId = uniqueId(`usr_admin_${prefix}`);
  const contributorUserId = uniqueId(`usr_contrib_${prefix}`);

  await prisma.tenant.create({ data: { id: tenantId, slug: uniqueId("slug"), name: `Tenant ${tenantId}`, status: "active" } });
  await prisma.org.create({ data: { id: orgId, tenantId, type: "internal", name: "KCP Registry Test Org" } });
  await prisma.user.createMany({
    data: [
      { id: adminUserId, email: `${adminUserId}@example.com`, status: "active" },
      { id: contributorUserId, email: `${contributorUserId}@example.com`, status: "active" }
    ]
  });

  return { tenantId, orgId, adminUserId, contributorUserId };
}

async function createMissionWithObservation(
  fixture: { tenantId: string; adminUserId: string; contributorUserId: string },
  input: { title: string; trade: string; category: string; objective: string; promotionStatus?: "PENDING" | "PROMOTED" | "REJECTED" }
) {
  const mission = await prisma.knowledgeMission.create({
    data: {
      tenantId: fixture.tenantId,
      createdByUserId: fixture.adminUserId,
      title: input.title,
      trade: input.trade,
      category: input.category,
      description: "test",
      difficulty: "beginner",
      requirementsJson: ["req"],
      evidenceRequestedJson: ["ev"],
      acceptanceCriteriaJson: ["crit"],
      baseCompensationCents: 500,
      currency: "USD",
      isDemo: true
    }
  });
  const acceptance = await prisma.knowledgeMissionAcceptance.create({
    data: {
      tenantId: fixture.tenantId,
      missionId: mission.id,
      userId: fixture.contributorUserId,
      missionVersionSnapshot: 1,
      compensationCentsSnapshot: 500,
      currencySnapshot: "USD"
    }
  });
  const submission = await prisma.knowledgeSubmission.create({
    data: { tenantId: fixture.tenantId, acceptanceId: acceptance.id, missionId: mission.id, userId: fixture.contributorUserId }
  });
  const extraction = await prisma.knowledgeExtraction.create({
    data: {
      tenantId: fixture.tenantId,
      submissionId: submission.id,
      kind: "TRANSCRIPTION",
      status: "COMPLETED",
      modelOrProcess: "prometeo-intake-pipeline"
    }
  });
  const observation = await prisma.observation.create({
    data: {
      tenantId: fixture.tenantId,
      submissionId: submission.id,
      extractionId: extraction.id,
      objective: input.objective,
      sourceSegmentIdsJson: [],
      generatedBy: "prometeo-intake-pipeline",
      ...(input.promotionStatus && input.promotionStatus !== "PENDING"
        ? { promotionStatus: input.promotionStatus, promotedByUserId: fixture.adminUserId, promotedAt: new Date(), promotionReason: "test" }
        : {})
    }
  });

  return { mission, submission, extraction, observation };
}

async function cleanupTenant(fixture: { tenantId: string; adminUserId: string; contributorUserId: string }) {
  await prisma.observation.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.knowledgeExtraction.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.knowledgeSubmission.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.knowledgeMissionAcceptance.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.knowledgeMission.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.org.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.tenant.deleteMany({ where: { id: fixture.tenantId } });
  await prisma.user.deleteMany({ where: { id: { in: [fixture.adminUserId, fixture.contributorUserId] } } });
}

function adminCtx(fixture: { tenantId: string; orgId: string; adminUserId: string }) {
  return { tenantId: fixture.tenantId, orgId: fixture.orgId, userId: fixture.adminUserId, roles: ["OPS_ADMIN"], requestId: "req-admin" };
}

function contributorCtx(fixture: { tenantId: string; orgId: string; contributorUserId: string }) {
  return { tenantId: fixture.tenantId, orgId: fixture.orgId, userId: fixture.contributorUserId, roles: ["WORKER"], requestId: "req-contrib" };
}

dbTest("registry only ever returns PROMOTED observations, with correct mission context", async () => {
  const fixture = await createTenant("reg1");
  try {
    const { service } = makeService();
    const promoted = await createMissionWithObservation(fixture, {
      title: "Panel electrico residencial",
      trade: "electrician",
      category: "residential",
      objective: "Conectar el neutral antes que la fase",
      promotionStatus: "PROMOTED"
    });
    await createMissionWithObservation(fixture, {
      title: "Fuga de agua",
      trade: "plumber",
      category: "leak",
      objective: "Cerrar la valvula principal",
      promotionStatus: "PENDING"
    });
    await createMissionWithObservation(fixture, {
      title: "Instalacion de tomacorriente",
      trade: "electrician",
      category: "residential",
      objective: "Usar guantes dielectricos",
      promotionStatus: "REJECTED"
    });

    const page = await service.getKnowledgeRegistry(adminCtx(fixture), { page: 1, pageSize: 20 });
    assert.equal(page.items.length, 1);
    assert.equal(page.total, 1);
    assert.equal(page.items[0]!.id, promoted.observation.id);
    assert.equal(page.items[0]!.promotionStatus, "PROMOTED");
    assert.equal(page.items[0]!.missionId, promoted.mission.id);
    assert.equal(page.items[0]!.missionTitle, "Panel electrico residencial");
    assert.equal(page.items[0]!.trade, "electrician");
    assert.equal(page.items[0]!.category, "residential");
  } finally {
    await cleanupTenant(fixture);
  }
});

dbTest("registry filters by trade, category, missionId and free-text search", async () => {
  const fixture = await createTenant("reg2");
  try {
    const { service } = makeService();
    const electricianA = await createMissionWithObservation(fixture, {
      title: "Electrician A",
      trade: "electrician",
      category: "residential",
      objective: "Conectar el neutral antes que la fase",
      promotionStatus: "PROMOTED"
    });
    const electricianB = await createMissionWithObservation(fixture, {
      title: "Electrician B",
      trade: "electrician",
      category: "commercial",
      objective: "Usar guantes dielectricos siempre",
      promotionStatus: "PROMOTED"
    });
    await createMissionWithObservation(fixture, {
      title: "Plumber A",
      trade: "plumber",
      category: "leak",
      objective: "Cerrar la valvula principal antes de cortar",
      promotionStatus: "PROMOTED"
    });

    const byTrade = await service.getKnowledgeRegistry(adminCtx(fixture), { trade: "electrician", page: 1, pageSize: 20 });
    assert.equal(byTrade.total, 2);
    assert.ok(byTrade.items.every((item) => item.trade === "electrician"));

    const byCategory = await service.getKnowledgeRegistry(adminCtx(fixture), { category: "commercial", page: 1, pageSize: 20 });
    assert.equal(byCategory.total, 1);
    assert.equal(byCategory.items[0]!.id, electricianB.observation.id);

    const byMission = await service.getKnowledgeRegistry(adminCtx(fixture), { missionId: electricianA.mission.id, page: 1, pageSize: 20 });
    assert.equal(byMission.total, 1);
    assert.equal(byMission.items[0]!.id, electricianA.observation.id);

    const bySearch = await service.getKnowledgeRegistry(adminCtx(fixture), { search: "dielectricos", page: 1, pageSize: 20 });
    assert.equal(bySearch.total, 1);
    assert.equal(bySearch.items[0]!.id, electricianB.observation.id);
  } finally {
    await cleanupTenant(fixture);
  }
});

dbTest("registry paginates with page/pageSize/total/hasMore", async () => {
  const fixture = await createTenant("reg3");
  try {
    const { service } = makeService();
    for (let i = 0; i < 3; i += 1) {
      await createMissionWithObservation(fixture, {
        title: `Mission ${i}`,
        trade: "electrician",
        category: "residential",
        objective: `Observation ${i}`,
        promotionStatus: "PROMOTED"
      });
    }

    const page1 = await service.getKnowledgeRegistry(adminCtx(fixture), { page: 1, pageSize: 2 });
    assert.equal(page1.items.length, 2);
    assert.equal(page1.total, 3);
    assert.equal(page1.hasMore, true);

    const page2 = await service.getKnowledgeRegistry(adminCtx(fixture), { page: 2, pageSize: 2 });
    assert.equal(page2.items.length, 1);
    assert.equal(page2.total, 3);
    assert.equal(page2.hasMore, false);
  } finally {
    await cleanupTenant(fixture);
  }
});

dbTest("registry never crosses tenants", async () => {
  const fixtureA = await createTenant("reg4a");
  const fixtureB = await createTenant("reg4b");
  try {
    const { service } = makeService();
    await createMissionWithObservation(fixtureA, {
      title: "Tenant A mission",
      trade: "electrician",
      category: "residential",
      objective: "Solo visible para el tenant A",
      promotionStatus: "PROMOTED"
    });
    await createMissionWithObservation(fixtureB, {
      title: "Tenant B mission",
      trade: "electrician",
      category: "residential",
      objective: "Solo visible para el tenant B",
      promotionStatus: "PROMOTED"
    });

    const pageA = await service.getKnowledgeRegistry(adminCtx(fixtureA), { page: 1, pageSize: 20 });
    assert.equal(pageA.total, 1);
    assert.equal(pageA.items[0]!.missionTitle, "Tenant A mission");
  } finally {
    await cleanupTenant(fixtureA);
    await cleanupTenant(fixtureB);
  }
});

dbTest("registry requires contributor-program:manage", async () => {
  const fixture = await createTenant("reg5");
  try {
    const { service } = makeService();
    await createMissionWithObservation(fixture, {
      title: "Some mission",
      trade: "electrician",
      category: "residential",
      objective: "Conectar el neutral",
      promotionStatus: "PROMOTED"
    });

    await assert.rejects(() => service.getKnowledgeRegistry(contributorCtx(fixture), { page: 1, pageSize: 20 }));
  } finally {
    await cleanupTenant(fixture);
  }
});
