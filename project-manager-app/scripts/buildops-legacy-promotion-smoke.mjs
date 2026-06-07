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
  const tenantId = uniqueId("tenant_smoke");
  const clientOrgId = uniqueId("org_client");
  const proOrgId = uniqueId("org_pro");
  const clientUserId = uniqueId("usr_client");
  const proUserId = uniqueId("usr_pro");
  const jobId = uniqueId("job_smoke");
  const buildOpsProjectId = uniqueId("bop_smoke");

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
    ],
  });

  await prisma.user.createMany({
    data: [
      { id: clientUserId, email: `${clientUserId}@example.com`, status: "active" },
      { id: proUserId, email: `${proUserId}@example.com`, status: "active" },
    ],
  });

  await prisma.job.create({
    data: {
      id: jobId,
      tenantId,
      clientOrgId,
      title: "Smoke BuildOps legacy promotion job",
      category: "Pintura interior",
      scope: "Paint living room and hallway with prep and cleanup.",
      status: "ACCEPTED",
      location: "Miami, FL",
      urgency: "medium",
    },
  });

  await prisma.jobReservation.create({
    data: {
      id: uniqueId("res"),
      jobId,
      professionalOrgId: proOrgId,
      professionalId: proUserId,
      status: "ACCEPTED",
      reservedAt: new Date(),
      expiresAt: new Date(),
      acceptedAt: new Date(),
    },
  });

  await prisma.project.create({
    data: {
      tenantId,
      jobId,
      assignedProOrgId: proOrgId,
      status: "OPEN",
    },
  });

  await prisma.projectIntake.create({
    data: {
      id: uniqueId("intake"),
      tenantId,
      userId: clientUserId,
      publishedJobId: jobId,
      rawDescription: "Paint living room and hallway.",
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
      title: "Smoke promotion plan",
      description: "Approved BuildOps plan ready to promote.",
      trade: "painting",
      projectType: "interior-painting",
      clientName: "Client Org",
      location: "Miami, FL",
      status: "estimating",
      sourceTool: "intake_operations_bridge",
      clientPlanApprovalStatus: "approved",
      clientPlanApprovedAt: new Date("2026-05-12T12:00:00.000Z"),
      clientPlanApprovedById: clientUserId,
      clientPlanApprovalSource: "client",
      sourceToolResult: {
        bridgeVersion: 1,
        estimate: {
          status: "ready",
          scopeSummary: "Prepare surfaces, protect furniture and paint two spaces.",
          missingInputs: [],
          tool: "painting",
          quoteSummary: {
            materials: 320,
            labor: 560,
            overhead: 80,
            profit: 90,
            semseFee: 60,
            contingency: 50,
            taxes: 40,
            subtotal: 1160,
            total: 1200,
            recommendedDeposit: 360,
            recommendedEscrow: 1200,
            currency: "USD",
            notes: [],
          },
        },
        milestonePlan: {
          trade: "painting",
          totalAmount: 1200,
          riskLevel: "medium",
          milestones: [
            {
              sequence: 1,
              title: "Scope confirmation",
              description: "Confirm measurements and furniture protection.",
              percentage: 40,
              amount: 480,
              evidenceRequired: ["before_photos", "measurements"],
              releaseTrigger: "scope_confirmed",
            },
            {
              sequence: 2,
              title: "Execution",
              description: "Complete prep and painting work.",
              percentage: 60,
              amount: 720,
              evidenceRequired: ["progress_photos", "after_photos", "client_approval"],
              releaseTrigger: "client_signoff",
            },
          ],
          fundingSchedule: [480, 720],
        },
        evidenceChecklist: {
          trade: "painting",
          riskLevel: "medium",
          requiredCount: 3,
          items: [
            {
              type: "photo",
              description: "Before photos",
              required: true,
              milestone: 1,
            },
            {
              type: "measurement",
              description: "Wall measurements",
              required: true,
              milestone: 1,
            },
            {
              type: "photo",
              description: "After photos",
              required: true,
              milestone: 2,
            },
          ],
          notes: [],
        },
        paymentReadiness: {
          status: "draft",
          ready: false,
          checks: {
            acceptedReservation: true,
            activeContract: false,
            signedClient: false,
            signedProfessional: false,
            projectLinked: true,
          },
          reasons: ["Falta un contrato activo para habilitar el escrow."],
          reservationId: null,
          contractId: null,
        },
      },
      completion: 15,
    },
  });

  await prisma.buildOpsTask.createMany({
    data: [
      {
        id: uniqueId("bot"),
        tenantId,
        orgId: clientOrgId,
        projectId: buildOpsProjectId,
        templateKey: "review_client_request",
        createdBy: clientUserId,
        title: "Review client request",
        description: "Review intake details and approve scope.",
        priority: "medium",
      },
      {
        id: uniqueId("bot"),
        tenantId,
        orgId: clientOrgId,
        projectId: buildOpsProjectId,
        templateKey: "request_missing_photos_evidence",
        createdBy: clientUserId,
        title: "Request missing photos",
        description: "Collect before and after evidence.",
        priority: "high",
      },
    ],
  });

  return {
    tenantId,
    clientOrgId,
    proOrgId,
    clientUserId,
    proUserId,
    jobId,
    buildOpsProjectId,
    userIds: [clientUserId, proUserId],
  };
}

async function main() {
  const fixture = await seedFixture();
  try {
    const clientActor = {
      tenantId: fixture.tenantId,
      orgId: fixture.clientOrgId,
      userId: fixture.clientUserId,
      roles: ["CLIENT"],
    };

    const beforeCounts = {
      project: await prisma.project.count({ where: { tenantId: fixture.tenantId } }),
      milestones: await prisma.milestone.count({ where: { project: { tenantId: fixture.tenantId } } }),
      tasks: await prisma.jobTask.count({ where: { tenantId: fixture.tenantId } }),
      evidence: await prisma.evidence.count({ where: { project: { tenantId: fixture.tenantId } } }),
    };

    const firstPromote = await api(
      "POST",
      `/v1/buildops/plans/${encodeURIComponent(fixture.buildOpsProjectId)}/promote-legacy`,
      clientActor,
    );
    assertHttpOk(firstPromote, "first promote");
    assert.equal(firstPromote.json?.data?.status, "promoted");
    assert.equal(firstPromote.json?.data?.alreadyPromoted, false);

    const afterFirstCounts = {
      project: await prisma.project.count({ where: { tenantId: fixture.tenantId } }),
      milestones: await prisma.milestone.count({
        where: {
          project: { tenantId: fixture.tenantId },
          promotedFromBuildOpsProjectId: fixture.buildOpsProjectId,
          deletedAt: null,
        },
      }),
      tasks: await prisma.jobTask.count({
        where: {
          tenantId: fixture.tenantId,
          promotedFromBuildOpsProjectId: fixture.buildOpsProjectId,
          deletedAt: null,
        },
      }),
      evidence: await prisma.evidence.count({
        where: {
          project: { tenantId: fixture.tenantId },
          promotedFromBuildOpsProjectId: fixture.buildOpsProjectId,
        },
      }),
    };

    assert.equal(afterFirstCounts.project, beforeCounts.project);
    assert.equal(afterFirstCounts.milestones, 2);
    assert.equal(afterFirstCounts.tasks, 2);
    assert.equal(afterFirstCounts.evidence, 1);

    const secondPromote = await api(
      "POST",
      `/v1/buildops/plans/${encodeURIComponent(fixture.buildOpsProjectId)}/promote-legacy`,
      clientActor,
    );
    assertHttpOk(secondPromote, "second promote");
    assert.equal(secondPromote.json?.data?.status, "already_promoted");
    assert.equal(secondPromote.json?.data?.alreadyPromoted, true);

    const afterSecondCounts = {
      milestones: await prisma.milestone.count({
        where: {
          project: { tenantId: fixture.tenantId },
          promotedFromBuildOpsProjectId: fixture.buildOpsProjectId,
          deletedAt: null,
        },
      }),
      tasks: await prisma.jobTask.count({
        where: {
          tenantId: fixture.tenantId,
          promotedFromBuildOpsProjectId: fixture.buildOpsProjectId,
          deletedAt: null,
        },
      }),
      evidence: await prisma.evidence.count({
        where: {
          project: { tenantId: fixture.tenantId },
          promotedFromBuildOpsProjectId: fixture.buildOpsProjectId,
        },
      }),
    };

    assert.deepEqual(afterSecondCounts, {
      milestones: afterFirstCounts.milestones,
      tasks: afterFirstCounts.tasks,
      evidence: afterFirstCounts.evidence,
    });

    const blockedUnapprove = await api(
      "POST",
      `/v1/buildops/plans/${encodeURIComponent(fixture.buildOpsProjectId)}/unapprove`,
      clientActor,
      { reason: "Too late" },
    );
    assert.equal(blockedUnapprove.status, 409, blockedUnapprove.text);

    console.log(JSON.stringify({
      ok: true,
      apiBaseUrl,
      buildOpsProjectId: fixture.buildOpsProjectId,
      firstPromote: firstPromote.json?.data,
      secondPromote: secondPromote.json?.data,
      counts: {
        before: beforeCounts,
        afterFirst: afterFirstCounts,
        afterSecond: afterSecondCounts,
      },
      blockedUnapproveStatus: blockedUnapprove.status,
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
