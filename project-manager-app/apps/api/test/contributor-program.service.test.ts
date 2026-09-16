import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { ContributorProgramRepository } from "../dist/modules/contributor-program/contributor-program.repository.js";
import { ContributorProgramService } from "../dist/modules/contributor-program/contributor-program.service.js";

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
  const repository = new ContributorProgramRepository(prisma as never);
  return { service: new ContributorProgramService(repository as never, fakeAudit as never), repository };
}

async function createFixture() {
  const tenantId = uniqueId("tenant_kcp");
  const orgId = uniqueId("org_kcp");
  const adminUserId = uniqueId("usr_admin");
  const contributorUserId = uniqueId("usr_contrib");
  const otherContributorUserId = uniqueId("usr_contrib_b");

  await prisma.tenant.create({
    data: { id: tenantId, slug: uniqueId("slug"), name: `Tenant ${tenantId}`, status: "active" },
  });
  await prisma.org.create({ data: { id: orgId, tenantId, type: "internal", name: "KCP Test Org" } });
  await prisma.user.createMany({
    data: [
      { id: adminUserId, email: `${adminUserId}@example.com`, status: "active" },
      { id: contributorUserId, email: `${contributorUserId}@example.com`, status: "active" },
      { id: otherContributorUserId, email: `${otherContributorUserId}@example.com`, status: "active" },
    ],
  });

  return { tenantId, orgId, adminUserId, contributorUserId, otherContributorUserId };
}

async function cleanupFixture(fixture: Awaited<ReturnType<typeof createFixture>>) {
  await prisma.contributorReward.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.knowledgeExtraction.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.knowledgeAppeal.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.knowledgeReview.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.knowledgeAsset.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.knowledgeSubmission.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.knowledgeMissionAcceptance.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.knowledgeMission.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.contributorConsent.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.contributorProfile.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.org.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.tenant.deleteMany({ where: { id: fixture.tenantId } });
  await prisma.user.deleteMany({
    where: { id: { in: [fixture.adminUserId, fixture.contributorUserId, fixture.otherContributorUserId] } },
  });
}

// T: consent persists the exact terms version accepted, and accepting a
// later version never overwrites (or requires overwriting) the earlier one.
dbTest("consent persists the correct version and a new version doesn't overwrite an older acceptance", async () => {
  const fixture = await createFixture();
  const termsVersionIds: string[] = [];
  try {
    const { repository } = makeService();

    const v1 = await prisma.contributorTermsVersion.create({
      data: {
        version: uniqueId("v1"),
        effectiveAt: new Date(),
        contentEs: "Contenido v1",
        contentEn: "Content v1",
        contentHash: "hash-v1",
        isActive: true,
      },
    });
    termsVersionIds.push(v1.id);

    const consentV1 = await repository.createConsent({
      tenantId: fixture.tenantId,
      userId: fixture.contributorUserId,
      termsVersionId: v1.id,
      termsContentHash: v1.contentHash,
      locale: "es",
      checkboxes: { isAdult: true, acceptedTerms: true, authorizedToRecord: true, understandsSafetyPriority: true, understandsDataUse: true },
    });
    assert.equal(consentV1.termsVersionId, v1.id);

    // Publish v2 and accept it too — this must not touch the v1 consent row.
    await prisma.contributorTermsVersion.updateMany({ where: { isActive: true }, data: { isActive: false } });
    const v2 = await prisma.contributorTermsVersion.create({
      data: {
        version: uniqueId("v2"),
        effectiveAt: new Date(),
        contentEs: "Contenido v2",
        contentEn: "Content v2",
        contentHash: "hash-v2",
        isActive: true,
      },
    });
    termsVersionIds.push(v2.id);
    const consentV2 = await repository.createConsent({
      tenantId: fixture.tenantId,
      userId: fixture.contributorUserId,
      termsVersionId: v2.id,
      termsContentHash: v2.contentHash,
      locale: "es",
      checkboxes: { isAdult: true, acceptedTerms: true, authorizedToRecord: true, understandsSafetyPriority: true, understandsDataUse: true },
    });

    const stillThereV1 = await repository.findConsent(fixture.contributorUserId, v1.id);
    assert.ok(stillThereV1, "v1 consent must still exist after accepting v2");
    assert.equal(stillThereV1?.termsVersionId, v1.id);

    const latest = await repository.findLatestConsent(fixture.contributorUserId);
    assert.equal(latest?.termsVersionId, v2.id);
    assert.notEqual(consentV1.id, consentV2.id);
  } finally {
    // Consents FK-reference these terms versions — must go first.
    await cleanupFixture(fixture);
    await prisma.contributorTermsVersion.deleteMany({ where: { id: { in: termsVersionIds } } });
  }
});

// T: a mission acceptance pins compensation/currency/deadline at accept
// time — a later edit to the mission's live values must never change an
// already-accepted acceptance's snapshot.
dbTest("mission acceptance keeps its price/version snapshot even after the mission changes", async () => {
  const fixture = await createFixture();
  try {
    const { service, repository } = makeService();

    const mission = await repository.createMission({
      tenantId: fixture.tenantId,
      createdByUserId: fixture.adminUserId,
      title: "Documentar un offset EMT (test)",
      trade: "electrician",
      category: "conduit_bending",
      description: "test",
      difficulty: "intermediate",
      requirements: ["req"],
      evidenceRequested: ["ev"],
      acceptanceCriteria: ["crit"],
      baseCompensationCents: 500,
      currency: "USD",
      isDemo: true,
    });
    await repository.updateMissionStatus(mission.id, "PUBLISHED");

    // Contributor must have accepted the active terms before accepting a
    // mission — deactivate any terms row left active by another test/run
    // first, matching repository.createTermsVersion's own semantics, so
    // findActiveTermsVersion() deterministically resolves to this one.
    await prisma.contributorTermsVersion.updateMany({ where: { isActive: true }, data: { isActive: false } });
    const terms = await prisma.contributorTermsVersion.create({
      data: {
        version: uniqueId("v"),
        effectiveAt: new Date(),
        contentEs: "c",
        contentEn: "c",
        contentHash: "h",
        isActive: true,
      },
    });
    await repository.createConsent({
      tenantId: fixture.tenantId,
      userId: fixture.contributorUserId,
      termsVersionId: terms.id,
      termsContentHash: terms.contentHash,
      locale: "es",
      checkboxes: { isAdult: true, acceptedTerms: true, authorizedToRecord: true, understandsSafetyPriority: true, understandsDataUse: true },
    });

    const acceptance = await service.acceptMission(
      { tenantId: fixture.tenantId, orgId: fixture.orgId, userId: fixture.contributorUserId, roles: ["WORKER"], requestId: "req-1" },
      mission.id
    );
    assert.equal(acceptance.compensationCentsSnapshot, 500);

    // Simulate a mission price change after acceptance (e.g. a republished v2).
    await prisma.knowledgeMission.update({ where: { id: mission.id }, data: { baseCompensationCents: 999999, version: 2 } });

    const reloaded = await repository.findAcceptanceById(acceptance.id);
    assert.equal(reloaded?.compensationCentsSnapshot, 500, "acceptance snapshot must not follow the mission's new price");
  } finally {
    await cleanupFixture(fixture);
    await prisma.contributorTermsVersion.deleteMany({ where: { contentHash: "h" } });
  }
});

// T: authorizing a reward payout twice never creates or pays a second
// reward for the same submission (payment idempotency).
dbTest("reward creation is idempotent per submission", async () => {
  const fixture = await createFixture();
  try {
    const { repository } = makeService();

    const mission = await repository.createMission({
      tenantId: fixture.tenantId,
      createdByUserId: fixture.adminUserId,
      title: "Idempotency test mission",
      trade: "electrician",
      category: "test",
      description: "test",
      difficulty: "beginner",
      requirements: ["req"],
      evidenceRequested: ["ev"],
      acceptanceCriteria: ["crit"],
      baseCompensationCents: 1000,
      currency: "USD",
      isDemo: true,
    });
    const acceptance = await repository.createAcceptance({
      tenantId: fixture.tenantId,
      missionId: mission.id,
      userId: fixture.contributorUserId,
      missionVersionSnapshot: 1,
      compensationCentsSnapshot: 1000,
      currencySnapshot: "USD",
    });
    const submission = await repository.createSubmission({
      tenantId: fixture.tenantId,
      acceptanceId: acceptance.id,
      missionId: mission.id,
      userId: fixture.contributorUserId,
    });

    const first = await repository.createReward({
      tenantId: fixture.tenantId,
      submissionId: submission.id,
      userId: fixture.contributorUserId,
      amountCents: 1000,
      currency: "USD",
      idempotencyKey: `contributor-reward:${submission.id}`,
    });
    const second = await repository.createReward({
      tenantId: fixture.tenantId,
      submissionId: submission.id,
      userId: fixture.contributorUserId,
      amountCents: 1000,
      currency: "USD",
      idempotencyKey: `contributor-reward:${submission.id}`,
    });

    assert.equal(first.id, second.id, "a second createReward call for the same submission must return the same row");

    const allRewardsForSubmission = await prisma.contributorReward.findMany({ where: { submissionId: submission.id } });
    assert.equal(allRewardsForSubmission.length, 1, "exactly one reward row must exist for the submission");
  } finally {
    await cleanupFixture(fixture);
  }
});

// T: every extraction row keeps its provenance — which submission/asset it
// came from, which model/process produced it, and its version — so
// RAG-facing knowledge can always be traced back to source evidence.
dbTest("knowledge extractions always keep provenance back to submission and asset", async () => {
  const fixture = await createFixture();
  try {
    const { repository } = makeService();

    const mission = await repository.createMission({
      tenantId: fixture.tenantId,
      createdByUserId: fixture.adminUserId,
      title: "Provenance test mission",
      trade: "electrician",
      category: "test",
      description: "test",
      difficulty: "beginner",
      requirements: ["req"],
      evidenceRequested: ["ev"],
      acceptanceCriteria: ["crit"],
      baseCompensationCents: 500,
      currency: "USD",
      isDemo: true,
    });
    const acceptance = await repository.createAcceptance({
      tenantId: fixture.tenantId,
      missionId: mission.id,
      userId: fixture.contributorUserId,
      missionVersionSnapshot: 1,
      compensationCentsSnapshot: 500,
      currencySnapshot: "USD",
    });
    const submission = await repository.createSubmission({
      tenantId: fixture.tenantId,
      acceptanceId: acceptance.id,
      missionId: mission.id,
      userId: fixture.contributorUserId,
    });
    const asset = await repository.createAsset({
      tenantId: fixture.tenantId,
      submissionId: submission.id,
      uploadedByUserId: fixture.contributorUserId,
      kind: "VIDEO",
      clipRole: "EXECUTION",
      storageKey: "tenants/x/knowledge_contribution/clip.mp4",
      mimeType: "video/mp4",
    });

    const extraction = await repository.createExtraction({
      tenantId: fixture.tenantId,
      submissionId: submission.id,
      assetId: asset.id,
      kind: "TRANSCRIPTION",
      status: "PENDING",
      modelOrProcess: "prometeo-intake-pipeline",
    });

    assert.equal(extraction.submissionId, submission.id);
    assert.equal(extraction.assetId, asset.id);
    assert.equal(extraction.modelOrProcess, "prometeo-intake-pipeline");
    assert.equal(extraction.version, 1);
  } finally {
    await cleanupFixture(fixture);
  }
});
