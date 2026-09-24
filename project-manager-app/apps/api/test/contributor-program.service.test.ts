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
const fakeStorage = { publicUrl: (key: string) => `https://storage.test/v1/uploads/files/${key}` };
// PR-9: not exercised by this file's tests (no promote/reject calls here) —
// present only so ContributorProgramService's constructor is satisfied.
const fakePrometeo = {
  async ingestText() {
    throw new Error("fakePrometeo.ingestText should not be called from this test file");
  },
  async deleteDocument() {
    throw new Error("fakePrometeo.deleteDocument should not be called from this test file");
  }
};

function makeService(overrides?: { stripeConnect?: unknown }) {
  const repository = new ContributorProgramRepository(prisma as never);
  return {
    service: new ContributorProgramService(
      repository as never,
      fakeAudit as never,
      fakeStorage as never,
      fakePrometeo as never,
      undefined,
      overrides?.stripeConnect as never
    ),
    repository
  };
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
      isDemo: false,
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

// T: a demo/example mission (seeded for onboarding, never payable) can never
// be accepted — regardless of its PUBLISHED status or a valid consent.
dbTest("accepting a demo mission is rejected and never creates an acceptance", async () => {
  const fixture = await createFixture();
  try {
    const { service, repository } = makeService();

    const mission = await repository.createMission({
      tenantId: fixture.tenantId,
      createdByUserId: fixture.adminUserId,
      title: "Documentar un offset EMT (demo)",
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

    await prisma.contributorTermsVersion.updateMany({ where: { isActive: true }, data: { isActive: false } });
    const terms = await prisma.contributorTermsVersion.create({
      data: {
        version: uniqueId("v"),
        effectiveAt: new Date(),
        contentEs: "c",
        contentEn: "c",
        contentHash: "h-demo",
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

    await assert.rejects(
      () =>
        service.acceptMission(
          { tenantId: fixture.tenantId, orgId: fixture.orgId, userId: fixture.contributorUserId, roles: ["WORKER"], requestId: "req-1" },
          mission.id
        ),
      (error: unknown) => {
        assert.equal((error as { getResponse?: () => { code?: string } }).getResponse?.().code, "CONTRIBUTOR_PROGRAM_MISSION_IS_DEMO");
        return true;
      }
    );

    const existing = await repository.findAcceptance(mission.id, fixture.contributorUserId);
    assert.equal(existing, null, "a demo mission must never produce an acceptance row");
  } finally {
    await cleanupFixture(fixture);
    await prisma.contributorTermsVersion.deleteMany({ where: { contentHash: "h-demo" } });
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

// isDemo defaults to false: payouts are only meant for real missions, and
// authorizePayout now refuses demo ones outright (docs/specs/core/
// knowledge-contributor-demo-mission-guards.spec.md P3).
async function createRewardFixture(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  repository: ContributorProgramRepository,
  amountCents = 1000,
  options: { isDemo?: boolean } = {}
) {
  const mission = await repository.createMission({
    tenantId: fixture.tenantId,
    createdByUserId: fixture.adminUserId,
    title: "Payout hardening test mission",
    trade: "electrician",
    category: "test",
    description: "test",
    difficulty: "beginner",
    requirements: ["req"],
    evidenceRequested: ["ev"],
    acceptanceCriteria: ["crit"],
    baseCompensationCents: amountCents,
    currency: "USD",
    isDemo: options.isDemo ?? false,
  });
  const acceptance = await repository.createAcceptance({
    tenantId: fixture.tenantId,
    missionId: mission.id,
    userId: fixture.contributorUserId,
    missionVersionSnapshot: 1,
    compensationCentsSnapshot: amountCents,
    currencySnapshot: "USD",
  });
  const submission = await repository.createSubmission({
    tenantId: fixture.tenantId,
    acceptanceId: acceptance.id,
    missionId: mission.id,
    userId: fixture.contributorUserId,
  });
  const reward = await repository.createReward({
    tenantId: fixture.tenantId,
    submissionId: submission.id,
    userId: fixture.contributorUserId,
    amountCents,
    currency: "USD",
    idempotencyKey: `contributor-reward:${submission.id}`,
  });
  return { mission, acceptance, submission, reward };
}

function makeFakeStripeConnect(transferId: string, delayMs = 15) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    async transferToContractor(input: { userId: string; amountUsd: number; currency: string }) {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return { transferId, platformFeeCents: 0, netAmountUsd: input.amountUsd };
    }
  };
}

// T: two concurrent authorize-payout calls for the same reward (a
// double-click, or two admin sessions) must never both reach the payment
// provider — the pre-PR-10 code read status via a plain query with no
// atomic claim, so both could pass the eligibility check before either
// wrote, and both would call Stripe for real (docs/specs/core/
// knowledge-contributor-reward-hardening.spec.md §4 P1).
dbTest("authorizing the same reward concurrently never calls the payment provider twice", async () => {
  const fixture = await createFixture();
  try {
    const stripeConnect = makeFakeStripeConnect("tr_test_concurrent");
    const { service, repository } = makeService({ stripeConnect });
    const { reward } = await createRewardFixture(fixture, repository);

    const adminCtx = {
      tenantId: fixture.tenantId,
      orgId: fixture.orgId,
      userId: fixture.adminUserId,
      roles: ["OPS_ADMIN"],
      requestId: "req-admin",
    };

    const results = await Promise.allSettled([
      service.authorizePayout(adminCtx, reward.id),
      service.authorizePayout(adminCtx, reward.id),
    ]);

    assert.equal(stripeConnect.calls, 1, "the real payment provider must be called exactly once, never twice");

    const fulfilled = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof service.authorizePayout>>> => r.status === "fulfilled");
    assert.ok(fulfilled.length >= 1, "at least one of the two concurrent calls must succeed");
    assert.ok(
      fulfilled.every((r) => r.value.status === "PAID"),
      "any fulfilled result must reflect the real PAID outcome, never a fabricated success"
    );

    const finalReward = await prisma.contributorReward.findUnique({ where: { id: reward.id } });
    assert.equal(finalReward?.status, "PAID");
    assert.equal(finalReward?.transferId, "tr_test_concurrent");
  } finally {
    await cleanupFixture(fixture);
  }
});

// T: authorizing an already-PAID reward again must stay idempotent — no
// second provider call, same result returned.
dbTest("authorizing an already-paid reward again does not call the provider again", async () => {
  const fixture = await createFixture();
  try {
    const stripeConnect = makeFakeStripeConnect("tr_test_idempotent");
    const { service, repository } = makeService({ stripeConnect });
    const { reward } = await createRewardFixture(fixture, repository);

    const adminCtx = {
      tenantId: fixture.tenantId,
      orgId: fixture.orgId,
      userId: fixture.adminUserId,
      roles: ["OPS_ADMIN"],
      requestId: "req-admin",
    };

    const first = await service.authorizePayout(adminCtx, reward.id);
    assert.equal(first.status, "PAID");
    assert.equal(stripeConnect.calls, 1);

    const second = await service.authorizePayout(adminCtx, reward.id);
    assert.equal(second.status, "PAID");
    assert.equal(second.id, first.id);
    assert.equal(stripeConnect.calls, 1, "re-authorizing a PAID reward must not call the provider again");
  } finally {
    await cleanupFixture(fixture);
  }
});

// T: a transfer.reversed Stripe event for a reward's transferId must move
// it to REVERSED — otherwise a reward that Stripe later reversed (e.g.
// insufficient platform balance) stays incorrectly PAID forever (spec §4 P3).
dbTest("reconcileReversedTransfer moves a PAID reward with a matching transferId to REVERSED", async () => {
  const fixture = await createFixture();
  try {
    const stripeConnect = makeFakeStripeConnect("tr_test_reversal");
    const { service, repository } = makeService({ stripeConnect });
    const { reward } = await createRewardFixture(fixture, repository);

    const adminCtx = {
      tenantId: fixture.tenantId,
      orgId: fixture.orgId,
      userId: fixture.adminUserId,
      roles: ["OPS_ADMIN"],
      requestId: "req-admin",
    };
    await service.authorizePayout(adminCtx, reward.id);

    const result = await service.reconcileReversedTransfer("tr_test_reversal");
    assert.equal(result.reconciled, true);

    const finalReward = await prisma.contributorReward.findUnique({ where: { id: reward.id } });
    assert.equal(finalReward?.status, "REVERSED");
  } finally {
    await cleanupFixture(fixture);
  }
});

// T: a transferId that doesn't belong to any ContributorReward (the normal
// case — most transfer.reversed events are milestone releases, not
// contributor rewards) must not throw or reconcile anything (spec §4 P4).
dbTest("reconcileReversedTransfer is a safe no-op for a transferId that isn't a reward", async () => {
  const fixture = await createFixture();
  try {
    const { service, repository } = makeService();
    await createRewardFixture(fixture, repository); // unrelated reward exists, never authorized

    const result = await service.reconcileReversedTransfer("tr_not_a_reward_transfer");
    assert.equal(result.reconciled, false);
  } finally {
    await cleanupFixture(fixture);
  }
});

// ── Demo mission guards (docs/specs/core/knowledge-contributor-demo-mission-guards.spec.md) ──
// acceptMission has refused demo missions since PR-2, but acceptances created
// before that guard existed still flow through the rest of the pipeline.
// These tests build such an acceptance directly through the repository — the
// only way one can exist now — and check every later step refuses it.

function isDemoError(code: string) {
  return (error: unknown) => {
    assert.equal((error as { getResponse?: () => { code?: string } }).getResponse?.().code, code);
    return true;
  };
}

// T (P1): a pre-existing demo acceptance can't be turned into a new submission.
dbTest("creating a submission on a demo-mission acceptance is rejected", async () => {
  const fixture = await createFixture();
  try {
    const { service, repository } = makeService();
    const { acceptance, submission } = await createRewardFixture(fixture, repository, 500, { isDemo: true });

    await assert.rejects(
      () =>
        service.createSubmission(
          { tenantId: fixture.tenantId, orgId: fixture.orgId, userId: fixture.contributorUserId, roles: ["WORKER"], requestId: "req-1" },
          acceptance.id
        ),
      isDemoError("CONTRIBUTOR_PROGRAM_MISSION_IS_DEMO")
    );

    const submissions = await prisma.knowledgeSubmission.findMany({ where: { acceptanceId: acceptance.id } });
    assert.deepEqual(
      submissions.map((row) => row.id),
      [submission.id],
      "no submission beyond the fixture's own must be created for a demo acceptance"
    );
  } finally {
    await cleanupFixture(fixture);
  }
});

// T (P2): approving a demo submission records the review but never creates a reward.
dbTest("approving a demo-mission submission never creates a reward", async () => {
  const fixture = await createFixture();
  try {
    const { service, repository } = makeService();
    const mission = await repository.createMission({
      tenantId: fixture.tenantId,
      createdByUserId: fixture.adminUserId,
      title: "Documentar un offset EMT (demo)",
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
    await repository.updateSubmissionStatus(submission.id, "SUBMITTED");

    const review = await service.reviewSubmission(
      { tenantId: fixture.tenantId, orgId: fixture.orgId, userId: fixture.adminUserId, roles: ["OPS_ADMIN"], requestId: "req-admin" },
      submission.id,
      { decision: "APPROVED", reason: "Buen ejemplo" }
    );
    assert.equal(review.decision, "APPROVED");

    const reward = await prisma.contributorReward.findUnique({ where: { submissionId: submission.id } });
    assert.equal(reward, null, "a demo mission must never produce a reward row");

    const after = await prisma.knowledgeSubmission.findUnique({ where: { id: submission.id } });
    assert.equal(after?.status, "APPROVED", "a demo submission must not advance to PAYMENT_PENDING");
  } finally {
    await cleanupFixture(fixture);
  }
});

// T (P3): a reward that already exists for a demo mission is never paid out.
dbTest("authorizing payout for a demo-mission reward is refused and never calls the provider", async () => {
  const fixture = await createFixture();
  try {
    const stripeConnect = makeFakeStripeConnect("tr_test_demo");
    const { service, repository } = makeService({ stripeConnect });
    const { reward } = await createRewardFixture(fixture, repository, 500, { isDemo: true });

    await assert.rejects(
      () =>
        service.authorizePayout(
          { tenantId: fixture.tenantId, orgId: fixture.orgId, userId: fixture.adminUserId, roles: ["OPS_ADMIN"], requestId: "req-admin" },
          reward.id
        ),
      isDemoError("CONTRIBUTOR_PROGRAM_REWARD_NOT_PAYABLE")
    );

    assert.equal(stripeConnect.calls, 0, "a demo reward must never reach the payment provider");
    const after = await prisma.contributorReward.findUnique({ where: { id: reward.id } });
    assert.equal(after?.status, "PENDING_REVIEW", "a refused demo reward must not be claimed or change status");
    assert.equal(after?.transferId, null);
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

// T: reviewers must be able to preview evidence inline — every asset with a
// storageKey exposes a servable previewUrl built from StorageService, and
// assets without one (TEXT kind, or missing storageKey) honestly report null
// rather than a broken link.
dbTest("submission view exposes previewUrl for assets with a storageKey, null otherwise", async () => {
  const fixture = await createFixture();
  try {
    const { service, repository } = makeService();

    const mission = await repository.createMission({
      tenantId: fixture.tenantId,
      createdByUserId: fixture.adminUserId,
      title: "Preview URL test mission",
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

    const contributorCtx = {
      tenantId: fixture.tenantId,
      orgId: fixture.orgId,
      userId: fixture.contributorUserId,
      roles: ["WORKER"],
      requestId: "req-contrib",
    };
    const adminCtx = {
      tenantId: fixture.tenantId,
      orgId: fixture.orgId,
      userId: fixture.adminUserId,
      roles: ["OPS_ADMIN"],
      requestId: "req-admin",
    };

    const videoAsset = await service.registerAsset(contributorCtx, submission.id, {
      kind: "VIDEO",
      clipRole: "EXECUTION",
      key: "tenants/x/knowledge_contribution/clip.mp4",
      mimeType: "video/mp4",
    });
    assert.equal(videoAsset.previewUrl, "https://storage.test/v1/uploads/files/tenants/x/knowledge_contribution/clip.mp4");

    const imageAsset = await service.registerAsset(contributorCtx, submission.id, {
      kind: "IMAGE",
      clipRole: "BEFORE",
      key: "tenants/x/knowledge_contribution/photo.jpg",
      mimeType: "image/jpeg",
    });
    assert.equal(imageAsset.previewUrl, "https://storage.test/v1/uploads/files/tenants/x/knowledge_contribution/photo.jpg");

    const audioAsset = await service.registerAsset(contributorCtx, submission.id, {
      kind: "AUDIO",
      clipRole: "OTHER",
      key: "tenants/x/knowledge_contribution/note.mp3",
      mimeType: "audio/mpeg",
    });
    assert.equal(audioAsset.previewUrl, "https://storage.test/v1/uploads/files/tenants/x/knowledge_contribution/note.mp3");

    const textAsset = await service.registerAsset(contributorCtx, submission.id, {
      kind: "TEXT",
      clipRole: "OTHER",
      textContent: "some notes",
    });
    assert.equal(textAsset.previewUrl, null);

    const view = await service.getSubmission(adminCtx, submission.id);
    const viewById = new Map(view.assets.map((asset) => [asset.id, asset]));
    assert.equal(
      viewById.get(videoAsset.id)?.previewUrl,
      "https://storage.test/v1/uploads/files/tenants/x/knowledge_contribution/clip.mp4"
    );
    assert.equal(viewById.get(textAsset.id)?.previewUrl, null);
  } finally {
    await cleanupFixture(fixture);
  }
});
