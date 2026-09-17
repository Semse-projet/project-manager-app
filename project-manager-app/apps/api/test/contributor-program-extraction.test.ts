import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { ContributorProgramRepository } from "../dist/modules/contributor-program/contributor-program.repository.js";
import { ContributorProgramService } from "../dist/modules/contributor-program/contributor-program.service.js";

// Transcript + Observation (PR-5) — docs/specs/core/
// knowledge-contributor-transcript-observation.spec.md. Split from
// contributor-program.service.test.ts per that spec's own "Mapa de
// implementación" note (new file if the existing one grows too large).

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
  const tenantId = uniqueId("tenant_kcp_ext");
  const orgId = uniqueId("org_kcp_ext");
  const adminUserId = uniqueId("usr_admin_ext");
  const contributorUserId = uniqueId("usr_contrib_ext");

  await prisma.tenant.create({
    data: { id: tenantId, slug: uniqueId("slug"), name: `Tenant ${tenantId}`, status: "active" },
  });
  await prisma.org.create({ data: { id: orgId, tenantId, type: "internal", name: "KCP Extraction Test Org" } });
  await prisma.user.createMany({
    data: [
      { id: adminUserId, email: `${adminUserId}@example.com`, status: "active" },
      { id: contributorUserId, email: `${contributorUserId}@example.com`, status: "active" },
    ],
  });

  const mission = await prisma.knowledgeMission.create({
    data: {
      tenantId,
      createdByUserId: adminUserId,
      title: "Extraction test mission",
      trade: "electrician",
      category: "test",
      description: "test",
      difficulty: "beginner",
      requirementsJson: ["req"],
      evidenceRequestedJson: ["ev"],
      acceptanceCriteriaJson: ["crit"],
      baseCompensationCents: 500,
      currency: "USD",
      isDemo: true,
    },
  });
  const acceptance = await prisma.knowledgeMissionAcceptance.create({
    data: {
      tenantId,
      missionId: mission.id,
      userId: contributorUserId,
      missionVersionSnapshot: 1,
      compensationCentsSnapshot: 500,
      currencySnapshot: "USD",
    },
  });
  const submission = await prisma.knowledgeSubmission.create({
    data: { tenantId, acceptanceId: acceptance.id, missionId: mission.id, userId: contributorUserId },
  });
  const asset = await prisma.knowledgeAsset.create({
    data: {
      tenantId,
      submissionId: submission.id,
      uploadedByUserId: contributorUserId,
      kind: "VIDEO",
      clipRole: "EXECUTION",
      storageKey: "tenants/x/knowledge_contribution/clip.mp4",
      mimeType: "video/mp4",
    },
  });

  return { tenantId, orgId, adminUserId, contributorUserId, mission, acceptance, submission, asset };
}

async function cleanupFixture(fixture: Awaited<ReturnType<typeof createFixture>>) {
  await prisma.observation.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.transcriptSegment.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.knowledgeExtraction.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.knowledgeAsset.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.knowledgeSubmission.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.knowledgeMissionAcceptance.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.knowledgeMission.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.org.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.tenant.deleteMany({ where: { id: fixture.tenantId } });
  await prisma.user.deleteMany({ where: { id: { in: [fixture.adminUserId, fixture.contributorUserId] } } });
}

function adminCtx(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return { tenantId: fixture.tenantId, orgId: fixture.orgId, userId: fixture.adminUserId, roles: ["OPS_ADMIN"], requestId: "req-admin" };
}

function contributorCtx(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return { tenantId: fixture.tenantId, orgId: fixture.orgId, userId: fixture.contributorUserId, roles: ["WORKER"], requestId: "req-contrib" };
}

// T: two workers racing for the same PENDING extraction must never both win
// the claim — the conditional updateMany (WHERE status = 'PENDING') is the
// idempotency guard the spec (§6, casos borde) requires.
dbTest("claimNextPendingTranscriptionExtraction is idempotent under a concurrent second claim", async () => {
  const fixture = await createFixture();
  try {
    const { repository } = makeService();
    await repository.createExtraction({
      tenantId: fixture.tenantId,
      submissionId: fixture.submission.id,
      assetId: fixture.asset.id,
      kind: "TRANSCRIPTION",
      status: "PENDING",
      modelOrProcess: "prometeo-intake-pipeline",
    });

    const firstClaim = await repository.claimNextPendingTranscriptionExtraction();
    assert.ok(firstClaim, "first worker must claim the pending row");
    assert.equal(firstClaim?.submissionId, fixture.submission.id);

    // Simulate a second worker racing for the same (now PROCESSING) row —
    // there is nothing left PENDING, so it must find nothing to claim.
    const secondClaim = await repository.claimNextPendingTranscriptionExtraction();
    assert.equal(secondClaim, null, "a second concurrent claim must not re-process the same row");

    const reloaded = await prisma.knowledgeExtraction.findUnique({ where: { id: firstClaim!.id } });
    assert.equal(reloaded?.status, "PROCESSING");
  } finally {
    await cleanupFixture(fixture);
  }
});

// T: with no ASR provider configured (the only state possible today per
// docs/specs/core/knowledge-contributor-transcript-observation.spec.md §11),
// the worker pipeline must move a PENDING extraction to FAILED with an
// honest, specific reason — never leave it silently PENDING forever, and
// never fabricate a transcript.
dbTest("processPendingExtractions honestly fails a PENDING row when no ASR provider is configured", async () => {
  const fixture = await createFixture();
  const previousProviderUrl = process.env.SEMSE_ASR_PROVIDER_URL;
  delete process.env.SEMSE_ASR_PROVIDER_URL;
  try {
    const { service, repository } = makeService();
    const extraction = await repository.createExtraction({
      tenantId: fixture.tenantId,
      submissionId: fixture.submission.id,
      assetId: fixture.asset.id,
      kind: "TRANSCRIPTION",
      status: "PENDING",
      modelOrProcess: "prometeo-intake-pipeline",
    });

    const result = await service.processPendingExtractions(adminCtx(fixture), 5);
    assert.equal(result.processed, 1);
    assert.equal(result.completed, 0);
    assert.equal(result.failed, 1);

    const reloaded = await prisma.knowledgeExtraction.findUnique({ where: { id: extraction.id } });
    assert.equal(reloaded?.status, "FAILED");
    assert.equal((reloaded?.dataJson as { failureReason?: string } | null)?.failureReason, "ASR_PROVIDER_NOT_CONFIGURED");
  } finally {
    if (previousProviderUrl === undefined) delete process.env.SEMSE_ASR_PROVIDER_URL;
    else process.env.SEMSE_ASR_PROVIDER_URL = previousProviderUrl;
    await cleanupFixture(fixture);
  }
});

// T: the reviewer-facing read must surface transcript segments and
// observations for a submission, and must stay tenant-scoped — a
// non-OPS_ADMIN actor must never be able to read another submission's
// extractions.
dbTest("getExtractionsForSubmission returns segments+observations and enforces admin-only access", async () => {
  const fixture = await createFixture();
  try {
    const { service, repository } = makeService();
    const claimed = await (async () => {
      await repository.createExtraction({
        tenantId: fixture.tenantId,
        submissionId: fixture.submission.id,
        assetId: fixture.asset.id,
        kind: "TRANSCRIPTION",
        status: "PENDING",
        modelOrProcess: "prometeo-intake-pipeline",
      });
      return repository.claimNextPendingTranscriptionExtraction();
    })();
    assert.ok(claimed);

    const { segments } = await repository.completeExtractionWithTranscript({
      extractionId: claimed!.id,
      tenantId: fixture.tenantId,
      submissionId: fixture.submission.id,
      assetId: fixture.asset.id,
      segments: [{ startMs: 0, endMs: 5000, text: "Conecté el neutral primero." }],
    });
    await repository.createObservation({
      tenantId: fixture.tenantId,
      submissionId: fixture.submission.id,
      extractionId: claimed!.id,
      objective: "Instalar un tomacorriente GFCI",
      sourceSegmentIds: [segments[0]!.id],
      generatedBy: "prometeo-intake-pipeline",
    });

    const views = await service.getExtractionsForSubmission(adminCtx(fixture), fixture.submission.id);
    assert.equal(views.length, 1);
    assert.equal(views[0]!.status, "COMPLETED");
    assert.equal(views[0]!.transcriptSegments.length, 1);
    assert.equal(views[0]!.transcriptSegments[0]!.text, "Conecté el neutral primero.");
    assert.equal(views[0]!.observations.length, 1);
    assert.equal(views[0]!.observations[0]!.isCorrected, false);

    await assert.rejects(() => service.getExtractionsForSubmission(contributorCtx(fixture), fixture.submission.id));
  } finally {
    await cleanupFixture(fixture);
  }
});

// T: correcting an Observation twice must not silently overwrite the first
// correction — the second attempt must fail with a 409-shaped conflict
// (spec §5: "una corrección no se sobreescribe con otra sin resolver el
// conflicto explícitamente").
dbTest("correcting an already-corrected observation is rejected as a conflict", async () => {
  const fixture = await createFixture();
  try {
    const { service, repository } = makeService();
    const extraction = await repository.createExtraction({
      tenantId: fixture.tenantId,
      submissionId: fixture.submission.id,
      assetId: fixture.asset.id,
      kind: "TRANSCRIPTION",
      status: "COMPLETED",
      modelOrProcess: "prometeo-intake-pipeline",
    });
    const observation = await repository.createObservation({
      tenantId: fixture.tenantId,
      submissionId: fixture.submission.id,
      extractionId: extraction.id,
      objective: "Draft objective",
      sourceSegmentIds: [],
      generatedBy: "prometeo-intake-pipeline",
    });

    const corrected = await service.correctObservation(adminCtx(fixture), observation.id, {
      correctedFields: { objective: "Corrected objective" },
      reason: "El texto original tenía un error de transcripción",
    });
    assert.equal(corrected.isCorrected, true);
    assert.equal(corrected.objective, "Corrected objective");

    await assert.rejects(
      () =>
        service.correctObservation(adminCtx(fixture), observation.id, {
          correctedFields: { objective: "Second correction attempt" },
          reason: "intentando corregir de nuevo",
        }),
      (error: unknown) => {
        assert.equal(
          (error as { getResponse?: () => { code?: string } }).getResponse?.().code,
          "CONTRIBUTOR_PROGRAM_OBSERVATION_ALREADY_CORRECTED"
        );
        return true;
      }
    );
  } finally {
    await cleanupFixture(fixture);
  }
});
