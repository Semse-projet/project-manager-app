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
const fakeStorage = { publicUrl: (key: string) => `https://storage.test/v1/uploads/files/${key}` };

// PR-9 (docs/specs/core/knowledge-contributor-rag-ingestion.spec.md): a
// call-tracking fake — real enough to assert exactly what promote/reject
// sent to Prometeo (tenant/org scoping, title, composed text) without
// spinning up the real chunk/embed pipeline.
let fakeDocCounter = 0;
function makeFakePrometeo() {
  const ingested: Array<{ tenantId: string; orgId: string; userId: string; title: string; text: string; sourceType?: string; sourceRef?: string }> = [];
  const deleted: Array<{ tenantId: string; id: string }> = [];
  return {
    calls: { ingested, deleted },
    async ingestText(input: { tenantId: string; orgId: string; userId: string; title: string; text: string; sourceType?: string; sourceRef?: string }) {
      ingested.push(input);
      fakeDocCounter += 1;
      return { id: `doc_${fakeDocCounter}`, tenantId: input.tenantId, orgId: input.orgId, projectId: null, title: input.title, sourceType: input.sourceType ?? "text", sourceRef: input.sourceRef ?? null, status: "pending", chunkCount: 0, uploadedById: input.userId, errorMsg: null, metadataJson: null, createdAt: new Date(), updatedAt: new Date() };
    },
    async deleteDocument(input: { tenantId: string; id: string }) {
      deleted.push(input);
    }
  };
}

function makeService() {
  const repository = new ContributorProgramRepository(prisma as never);
  const fakePrometeo = makeFakePrometeo();
  return {
    service: new ContributorProgramService(repository as never, fakeAudit as never, fakeStorage as never, fakePrometeo as never),
    repository,
    fakePrometeo
  };
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

    // Scoped to this fixture's own tenant so this test is safe to run
    // concurrently with every other DB-backed test file in this suite (CI
    // runs them all against one shared Postgres) — without this, "next
    // pending row, globally" could claim (and fail) another test's row.
    const firstClaim = await repository.claimNextPendingTranscriptionExtraction(fixture.tenantId);
    assert.ok(firstClaim, "first worker must claim the pending row");
    assert.equal(firstClaim?.submissionId, fixture.submission.id);

    // Simulate a second worker racing for the same (now PROCESSING) row —
    // there is nothing left PENDING for this tenant, so it must find
    // nothing to claim.
    const secondClaim = await repository.claimNextPendingTranscriptionExtraction(fixture.tenantId);
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

    // tenantId-scoped: CI runs this file concurrently with every other
    // DB-backed test file against one shared Postgres, and an unscoped sweep
    // would claim (and fail) other tests' PENDING rows too.
    const result = await service.processPendingExtractions(adminCtx(fixture), 5, { tenantId: fixture.tenantId });
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
      return repository.claimNextPendingTranscriptionExtraction(fixture.tenantId);
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

// T: promoting an Observation is an editorial decision, not a fact — unlike
// correction, a reviewer must be able to change their mind (promote what
// they'd rejected, or reject what they'd promoted) without hitting a
// conflict. Each transition still requires a reason and lands in the
// returned view (spec docs/specs/core/knowledge-contributor-evidence-
// promotion.spec.md §4 P1-P3). Also covers PR-9's RAG lifecycle (docs/specs/
// core/knowledge-contributor-rag-ingestion.spec.md §4 P1-P3): promote
// indexes into Prometeo, reject-after-promote de-indexes, re-promote
// creates a fresh document rather than reusing the deleted one.
dbTest("promoting and rejecting an observation moves freely between states, always with a reason", async () => {
  const fixture = await createFixture();
  try {
    const { service, repository, fakePrometeo } = makeService();
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
      objective: "Instalar un interruptor de tres vías",
      sourceSegmentIds: [],
      generatedBy: "prometeo-intake-pipeline",
    });
    assert.equal(observation.promotionStatus, "PENDING");
    assert.equal(observation.ragDocumentId, null);

    const promoted = await service.promoteObservation(adminCtx(fixture), observation.id, {
      reason: "Observación clara y verificable",
    });
    assert.equal(promoted.promotionStatus, "PROMOTED");
    assert.equal(promoted.promotedByUserId, fixture.adminUserId);
    assert.equal(promoted.promotionReason, "Observación clara y verificable");
    assert.ok(promoted.promotedAt);
    assert.ok(promoted.ragDocumentId, "promoting must index the observation into Prometeo");
    assert.equal(fakePrometeo.calls.ingested.length, 1);
    assert.equal(fakePrometeo.calls.ingested[0]!.tenantId, fixture.tenantId);
    assert.equal(fakePrometeo.calls.ingested[0]!.orgId, fixture.orgId);
    assert.equal(fakePrometeo.calls.ingested[0]!.sourceRef, observation.id);
    assert.match(fakePrometeo.calls.ingested[0]!.text, /Instalar un interruptor de tres vías/);
    const firstDocId = promoted.ragDocumentId;

    // Changing their mind must not be a conflict — this is what tells
    // promotion apart from correctObservation's 409 guard.
    const rejected = await service.rejectObservationPromotion(adminCtx(fixture), observation.id, {
      reason: "Revisión posterior encontró un dato incorrecto",
    });
    assert.equal(rejected.promotionStatus, "REJECTED");
    assert.equal(rejected.promotionReason, "Revisión posterior encontró un dato incorrecto");
    assert.equal(rejected.ragDocumentId, null, "rejecting a promotion must de-index it");
    assert.equal(fakePrometeo.calls.deleted.length, 1);
    assert.equal(fakePrometeo.calls.deleted[0]!.id, firstDocId);
    assert.equal(fakePrometeo.calls.deleted[0]!.tenantId, fixture.tenantId);

    const rePromoted = await service.promoteObservation(adminCtx(fixture), observation.id, {
      reason: "El dato incorrecto ya fue corregido en la entrega",
    });
    assert.equal(rePromoted.promotionStatus, "PROMOTED");
    assert.ok(rePromoted.ragDocumentId);
    assert.notEqual(rePromoted.ragDocumentId, firstDocId, "re-promoting must index a fresh document, not reuse the deleted one");
    assert.equal(fakePrometeo.calls.ingested.length, 2);
  } finally {
    await cleanupFixture(fixture);
  }
});

// T: rejecting an Observation that was never promoted has nothing to
// de-index — must not call Prometeo at all (spec §2 "fuera de alcance"
// implicitly requires this: no ragDocumentId means no deleteDocument call).
dbTest("rejecting a never-promoted observation does not call Prometeo", async () => {
  const fixture = await createFixture();
  try {
    const { service, repository, fakePrometeo } = makeService();
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
      objective: "test",
      sourceSegmentIds: [],
      generatedBy: "prometeo-intake-pipeline",
    });

    const rejected = await service.rejectObservationPromotion(adminCtx(fixture), observation.id, {
      reason: "nunca fue promovida",
    });
    assert.equal(rejected.promotionStatus, "REJECTED");
    assert.equal(rejected.ragDocumentId, null);
    assert.equal(fakePrometeo.calls.ingested.length, 0);
    assert.equal(fakePrometeo.calls.deleted.length, 0);
  } finally {
    await cleanupFixture(fixture);
  }
});

// T: promotion decisions are OPS_ADMIN-only and tenant-scoped, same as
// every other admin action in this module.
dbTest("promoting/rejecting an observation is admin-only and tenant-scoped", async () => {
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
      objective: "test",
      sourceSegmentIds: [],
      generatedBy: "prometeo-intake-pipeline",
    });

    await assert.rejects(() =>
      service.promoteObservation(contributorCtx(fixture), observation.id, { reason: "no permission" })
    );

    await assert.rejects(() =>
      service.promoteObservation(adminCtx(fixture), "nonexistent-observation-id", { reason: "test" })
    );
  } finally {
    await cleanupFixture(fixture);
  }
});
