import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

loadEnv({ path: path.join(repoRoot, "packages/db/.env") });

const apiBaseUrl = (process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000").replace(/\/+$/, "");
const prisma = new PrismaClient();

function uniqueId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function actorHeaders(actor) {
  return {
    "x-tenant-id": actor.tenantId,
    "x-org-id": actor.orgId,
    "x-user-id": actor.userId,
    "x-roles": actor.roles.join(","),
  };
}

async function readJson(response) {
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, text, json };
}

async function api(method, pathname, actor, body) {
  const headers = actorHeaders(actor);
  if (body) {
    headers["content-type"] = "application/json";
  }
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return readJson(response);
}

function assertHttpOk(result, label) {
  assert.ok(result.status === 200 || result.status === 201, `${label} failed: ${result.text}`);
}

async function cleanupFixture(input) {
  await prisma.milestone.deleteMany({ where: { project: { tenantId: input.tenantId } } });
  await prisma.evidence.deleteMany({ where: { project: { tenantId: input.tenantId } } });
  await prisma.paymentTxn.deleteMany({ where: { escrow: { project: { tenantId: input.tenantId } } } });
  await prisma.paymentEscrow.deleteMany({
    where: {
      OR: [{ project: { tenantId: input.tenantId } }, { job: { tenantId: input.tenantId } }],
    },
  });
  await prisma.jobTask.deleteMany({ where: { tenantId: input.tenantId } });
  await prisma.buildOpsPlanVersion.deleteMany({ where: { tenantId: input.tenantId } });
  await prisma.project.deleteMany({ where: { tenantId: input.tenantId } });
  await prisma.jobReservation.deleteMany({ where: { job: { tenantId: input.tenantId } } });
  await prisma.contract.deleteMany({ where: { job: { tenantId: input.tenantId } } });
  await prisma.buildOpsTask.deleteMany({ where: { tenantId: input.tenantId } });
  await prisma.buildOpsProject.deleteMany({ where: { tenantId: input.tenantId } });
  await prisma.projectIntake.deleteMany({ where: { tenantId: input.tenantId } });
  await prisma.job.deleteMany({ where: { tenantId: input.tenantId } });
  await prisma.membership.deleteMany({ where: { userId: { in: input.userIds } } });
  await prisma.org.deleteMany({ where: { tenantId: input.tenantId } });
  await prisma.tenant.deleteMany({ where: { id: input.tenantId } });
  await prisma.user.deleteMany({ where: { id: { in: input.userIds } } });
}

async function seedFixture() {
  const tenantId = uniqueId("tenant_rerun_smoke");
  const clientOrgId = uniqueId("org_client");
  const proOrgId = uniqueId("org_pro");
  const adminOrgId = uniqueId("org_admin");
  const clientUserId = uniqueId("usr_client");
  const proUserId = uniqueId("usr_pro");
  const adminUserId = uniqueId("usr_admin");
  const jobId = uniqueId("job_rerun_smoke");
  const buildOpsProjectId = uniqueId("bop_rerun_smoke");

  await prisma.tenant.create({
    data: {
      id: tenantId,
      slug: uniqueId("slug"),
      name: `Smoke Tenant ${tenantId}`,
      status: "active",
    },
  });

  await prisma.org.createMany({
    data: [
      { id: clientOrgId, tenantId, type: "client", name: "Client Org" },
      { id: proOrgId, tenantId, type: "pro", name: "Pro Org" },
      { id: adminOrgId, tenantId, type: "admin", name: "Admin Org" },
    ],
  });

  await prisma.user.createMany({
    data: [
      { id: clientUserId, email: `${clientUserId}@example.com`, status: "active" },
      { id: proUserId, email: `${proUserId}@example.com`, status: "active" },
      { id: adminUserId, email: `${adminUserId}@example.com`, status: "active" },
    ],
  });

  await prisma.job.create({
    data: {
      id: jobId,
      tenantId,
      clientOrgId,
      title: "Smoke BuildOps rerun job",
      category: "Pintura interior",
      scope: "Paint living room and hallway with client-requested changes.",
      status: "PUBLISHED",
      location: "Miami, FL",
      urgency: "medium",
    },
  });

  await prisma.projectIntake.create({
    data: {
      id: uniqueId("intake"),
      tenantId,
      userId: clientUserId,
      publishedJobId: jobId,
      rawDescription: "Paint living room and hallway with prep and cleanup.",
      normalizedTitle: "Paint living room and hallway",
      detectedCategory: "interior_painting",
      uploadedImagesJson: [
        {
          id: uniqueId("img"),
          key: `${tenantId}/intake/living-room-before.jpg`,
          url: "https://cdn.example.com/living-room-before.jpg",
          thumbnailUrl: "https://cdn.example.com/living-room-before-thumb.jpg",
          originalName: "living-room-before.jpg",
          contentType: "image/jpeg",
          sizeBytes: 2048,
          uploadedAt: new Date().toISOString(),
          imageType: "before",
          evidenceStatus: "attached_to_job",
        },
      ],
      projectScopeJson: {
        area: {
          value: 420,
        },
        paintCoats: {
          value: 2,
        },
      },
      generatedEstimateJson: {
        assumptions: [],
        confidenceReasons: [],
        totalRange: {
          min: 1500,
          max: 1800,
        },
        breakdown: {
          materials: { min: 350, max: 420 },
          labor: { min: 700, max: 820 },
          preparation: { min: 180, max: 220 },
          contingency: { min: 90, max: 120 },
        },
      },
      generatedMilestonesJson: [
        {
          order: 1,
          title: { en: "Scope confirmation" },
          description: { en: "Confirm measurements and prep." },
          paymentPercentage: 40,
          requiresEvidence: true,
        },
        {
          order: 2,
          title: { en: "Execution" },
          description: { en: "Complete prep and paint work." },
          paymentPercentage: 60,
          requiresEvidence: true,
        },
      ],
      activeWarningsJson: [],
      status: "published",
      publishedAt: new Date(),
    },
  });

  await prisma.buildOpsProject.create({
    data: {
      id: buildOpsProjectId,
      tenantId,
      orgId: clientOrgId,
      jobId,
      createdBy: clientUserId,
      title: "Smoke BuildOps rerun plan",
      description: "Existing plan before rerun.",
      trade: "painting",
      projectType: "interior-painting",
      clientName: "Client Org",
      location: "Miami, FL",
      status: "estimating",
      sourceTool: "intake_operations_bridge",
      sourceToolInput: {
        sourceKind: "smart_intake",
        jobId,
      },
      sourceToolResult: {
        schemaVersion: "1.0",
        bridgeVersion: 1,
        estimate: {
          status: "ready",
          scopeSummary: "Existing plan before rerun.",
          missingInputs: [],
          tool: "painting",
          quoteSummary: {
            total: 1500,
            recommendedDeposit: 450,
            recommendedEscrow: 1500,
            currency: "USD",
          },
        },
        milestonePlan: {
          trade: "painting",
          totalAmount: 1500,
          riskLevel: "medium",
          milestones: [
            {
              sequence: 1,
              title: "Existing milestone",
              description: "Existing milestone before rerun.",
              percentage: 100,
              amount: 1500,
              evidenceRequired: ["before_photos"],
              releaseTrigger: "client_signoff",
            },
          ],
          fundingSchedule: [1500],
        },
        evidenceChecklist: {
          trade: "painting",
          riskLevel: "medium",
          requiredCount: 1,
          items: [
            {
              type: "photo",
              description: "Before photos",
              required: true,
              milestone: 1,
            },
          ],
          notes: [],
        },
        paymentReadiness: {
          status: "draft",
          ready: false,
          checks: {
            acceptedReservation: false,
          },
          reasons: ["Contract pending"],
          reservationId: null,
          contractId: null,
        },
      },
      clientPlanApprovalStatus: "changes_requested",
      clientPlanReviewedAt: new Date("2026-05-12T16:00:00.000Z"),
      clientPlanReviewComment: "Reduce prep and refresh milestone plan.",
      completion: 15,
    },
  });

  return {
    tenantId,
    clientOrgId,
    adminOrgId,
    clientUserId,
    proUserId,
    adminUserId,
    jobId,
    buildOpsProjectId,
    userIds: [clientUserId, proUserId, adminUserId],
  };
}

async function main() {
  const fixture = await seedFixture();
  try {
    const adminActor = {
      tenantId: fixture.tenantId,
      orgId: fixture.adminOrgId,
      userId: fixture.adminUserId,
      roles: ["OPS_ADMIN"],
    };

    const firstRerun = await api(
      "POST",
      `/v1/buildops/plans/${encodeURIComponent(fixture.buildOpsProjectId)}/rerun-bridge`,
      adminActor,
    );
    assertHttpOk(firstRerun, "first rerun");
    assert.equal(firstRerun.json?.data?.status, "rerun_completed");
    assert.equal(firstRerun.json?.data?.approvalStatus, "pending");

    const versionsAfterFirst = await prisma.buildOpsPlanVersion.findMany({
      where: {
        tenantId: fixture.tenantId,
        buildOpsProjectId: fixture.buildOpsProjectId,
      },
      orderBy: {
        versionNumber: "asc",
      },
    });

    assert.deepEqual(
      versionsAfterFirst.map((version) => ({ versionNumber: version.versionNumber, status: version.status })),
      [
        { versionNumber: 1, status: "superseded" },
        { versionNumber: 2, status: "active" },
      ],
    );

    const planAfterFirst = await prisma.buildOpsProject.findUniqueOrThrow({
      where: {
        id: fixture.buildOpsProjectId,
      },
    });
    assert.equal(planAfterFirst.clientPlanApprovalStatus, "pending");

    const secondRerun = await api(
      "POST",
      `/v1/buildops/plans/${encodeURIComponent(fixture.buildOpsProjectId)}/rerun-bridge`,
      adminActor,
    );
    assert.equal(secondRerun.status, 409, secondRerun.text);

    await prisma.buildOpsProject.update({
      where: {
        id: fixture.buildOpsProjectId,
      },
      data: {
        clientPlanApprovalStatus: "changes_requested",
        legacyPromotionStatus: "promoted",
      },
    });

    const promotedBlocked = await api(
      "POST",
      `/v1/buildops/plans/${encodeURIComponent(fixture.buildOpsProjectId)}/rerun-bridge`,
      adminActor,
    );
    assert.equal(promotedBlocked.status, 409, promotedBlocked.text);

    console.log(JSON.stringify({
      ok: true,
      apiBaseUrl,
      buildOpsProjectId: fixture.buildOpsProjectId,
      firstRerun: firstRerun.json?.data,
      versionsAfterFirst: versionsAfterFirst.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        status: version.status,
      })),
      secondRerunStatus: secondRerun.status,
      promotedBlockedStatus: promotedBlocked.status,
    }, null, 2));
  } finally {
    await cleanupFixture({
      tenantId: fixture.tenantId,
      userIds: fixture.userIds,
    });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
