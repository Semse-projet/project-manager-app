import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { BuildOpsLegacyPromotionService } from "../dist/modules/buildops/buildops-legacy-promotion.service.js";
import { BuildOpsPlanApprovalService } from "../dist/modules/buildops/buildops-plan-approval.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");

loadEnv({ path: path.join(repoRoot, "packages/db/.env") });

const prisma = new PrismaClient();
const dbTest = process.env.DATABASE_URL ? test : test.skip;

function uniqueId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function cleanupFixture(input: {
  tenantId: string;
  userIds: string[];
}) {
  await prisma.milestone.deleteMany({
    where: {
      project: {
        tenantId: input.tenantId,
      },
    },
  });
  await prisma.evidence.deleteMany({
    where: {
      project: {
        tenantId: input.tenantId,
      },
    },
  });
  await prisma.paymentTxn.deleteMany({
    where: {
      escrow: {
        project: {
          tenantId: input.tenantId,
        },
      },
    },
  });
  await prisma.paymentEscrow.deleteMany({
    where: {
      OR: [
        {
          project: {
            tenantId: input.tenantId,
          },
        },
        {
          job: {
            tenantId: input.tenantId,
          },
        },
      ],
    },
  });
  await prisma.jobTask.deleteMany({
    where: {
      tenantId: input.tenantId,
    },
  });
  await prisma.project.deleteMany({
    where: {
      tenantId: input.tenantId,
    },
  });
  await prisma.jobReservation.deleteMany({
    where: {
      job: {
        tenantId: input.tenantId,
      },
    },
  });
  await prisma.contract.deleteMany({
    where: {
      job: {
        tenantId: input.tenantId,
      },
    },
  });
  await prisma.buildOpsTask.deleteMany({
    where: {
      tenantId: input.tenantId,
    },
  });
  await prisma.buildOpsProject.deleteMany({
    where: {
      tenantId: input.tenantId,
    },
  });
  await prisma.projectIntake.deleteMany({
    where: {
      tenantId: input.tenantId,
    },
  });
  await prisma.job.deleteMany({
    where: {
      tenantId: input.tenantId,
    },
  });
  await prisma.membership.deleteMany({
    where: {
      userId: {
        in: input.userIds,
      },
    },
  });
  await prisma.org.deleteMany({
    where: {
      tenantId: input.tenantId,
    },
  });
  await prisma.tenant.deleteMany({
    where: {
      id: input.tenantId,
    },
  });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: input.userIds,
      },
    },
  });
}

async function createFixture(input?: { approvalStatus?: "pending" | "approved" | "changes_requested" | "rejected" }) {
  const tenantId = uniqueId("tenant_legacy");
  const clientOrgId = uniqueId("org_client");
  const proOrgId = uniqueId("org_pro");
  const clientUserId = uniqueId("usr_client");
  const proUserId = uniqueId("usr_pro");
  const jobId = uniqueId("job_legacy");
  const buildOpsProjectId = uniqueId("bop_legacy");
  const intakeId = uniqueId("intake_legacy");

  await prisma.tenant.create({
    data: {
      id: tenantId,
      slug: uniqueId("slug"),
      name: `Tenant ${tenantId}`,
      status: "active",
    },
  });

  await prisma.org.createMany({
    data: [
      {
        id: clientOrgId,
        tenantId,
        type: "client",
        name: `Client Org ${clientOrgId}`,
      },
      {
        id: proOrgId,
        tenantId,
        type: "pro",
        name: `Pro Org ${proOrgId}`,
      },
    ],
  });

  await prisma.user.createMany({
    data: [
      {
        id: clientUserId,
        email: `${clientUserId}@example.com`,
        status: "active",
      },
      {
        id: proUserId,
        email: `${proUserId}@example.com`,
        status: "active",
      },
    ],
  });

  await prisma.job.create({
    data: {
      id: jobId,
      tenantId,
      clientOrgId,
      title: "Legacy promotion job",
      category: "Pintura interior",
      scope: "Prepare and paint the living room and hallway.",
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
      id: intakeId,
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
      title: "Legacy promotion plan",
      description: "Approved BuildOps plan awaiting promotion.",
      trade: "painting",
      projectType: "interior-painting",
      clientName: "Client Org",
      location: "Miami, FL",
      status: "estimating",
      sourceTool: "intake_operations_bridge",
      clientPlanApprovalStatus: input?.approvalStatus ?? "approved",
      clientPlanApprovedAt:
        input?.approvalStatus === undefined || input.approvalStatus === "approved"
          ? new Date("2026-05-12T12:00:00.000Z")
          : null,
      clientPlanApprovedById:
        input?.approvalStatus === undefined || input.approvalStatus === "approved"
          ? clientUserId
          : null,
      clientPlanApprovalSource:
        input?.approvalStatus === undefined || input.approvalStatus === "approved"
          ? "client"
          : null,
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

dbTest("legacy promotion integration promotes approved plan, is idempotent, and blocks unapprove afterwards", async (t) => {
  const fixture = await createFixture();
  t.after(async () => {
    await cleanupFixture({ tenantId: fixture.tenantId, userIds: fixture.userIds });
  });

  const promotionService = new BuildOpsLegacyPromotionService(prisma as never);
  const approvalService = new BuildOpsPlanApprovalService(prisma as never);

  const projectCountBefore = await prisma.project.count({
    where: {
      tenantId: fixture.tenantId,
    },
  });
  const paymentEscrowCountBefore = await prisma.paymentEscrow.count({
    where: {
      project: {
        tenantId: fixture.tenantId,
      },
    },
  });

  const first = await promotionService.promoteApprovedPlanToLegacy({
    tenantId: fixture.tenantId,
    orgId: fixture.clientOrgId,
    userId: fixture.clientUserId,
    roles: ["CLIENT"],
    buildOpsProjectId: fixture.buildOpsProjectId,
  });

  assert.equal(first.status, "promoted");
  assert.equal(first.milestonesCreated, 2);
  assert.equal(first.tasksCreated, 2);
  assert.equal(first.evidenceCreated, 1);
  assert.equal(first.paymentEscrowCreated, false);

  const projectCountAfterFirst = await prisma.project.count({
    where: {
      tenantId: fixture.tenantId,
    },
  });
  assert.equal(projectCountAfterFirst, projectCountBefore);

  const milestones = await prisma.milestone.findMany({
    where: {
      projectId: first.legacyProjectId,
      promotedFromBuildOpsProjectId: fixture.buildOpsProjectId,
      deletedAt: null,
    },
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      sequence: true,
      promotedFromBuildOpsProjectId: true,
      promotedByUserId: true,
      checklistSchema: true,
      requiredEvidenceTypes: true,
    },
  });
  assert.equal(milestones.length, 2);
  assert.equal(milestones[0]?.promotedFromBuildOpsProjectId, fixture.buildOpsProjectId);
  assert.equal(milestones[0]?.promotedByUserId, fixture.clientUserId);

  const promotedTasks = await prisma.jobTask.findMany({
    where: {
      tenantId: fixture.tenantId,
      jobId: fixture.jobId,
      promotedFromBuildOpsProjectId: fixture.buildOpsProjectId,
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      promotedFromBuildOpsTaskId: true,
      promotedByUserId: true,
    },
  });
  assert.equal(promotedTasks.length, 2);
  assert.ok(promotedTasks.every((task) => task.promotedFromBuildOpsTaskId));
  assert.ok(promotedTasks.every((task) => task.promotedByUserId === fixture.clientUserId));

  const promotedEvidence = await prisma.evidence.findMany({
    where: {
      projectId: first.legacyProjectId,
      promotedFromBuildOpsProjectId: fixture.buildOpsProjectId,
    },
    select: {
      id: true,
      bucketKey: true,
      promotedByUserId: true,
    },
  });
  assert.equal(promotedEvidence.length, 1);
  assert.equal(promotedEvidence[0]?.promotedByUserId, fixture.clientUserId);

  const paymentEscrowCountAfterFirst = await prisma.paymentEscrow.count({
    where: {
      project: {
        tenantId: fixture.tenantId,
      },
    },
  });
  assert.equal(paymentEscrowCountAfterFirst, paymentEscrowCountBefore);

  const second = await promotionService.promoteApprovedPlanToLegacy({
    tenantId: fixture.tenantId,
    orgId: fixture.clientOrgId,
    userId: fixture.clientUserId,
    roles: ["CLIENT"],
    buildOpsProjectId: fixture.buildOpsProjectId,
  });

  assert.equal(second.status, "already_promoted");
  assert.equal(second.alreadyPromoted, true);
  assert.equal(second.milestonesCreated, 0);
  assert.equal(second.tasksCreated, 0);
  assert.equal(second.evidenceCreated, 0);

  const milestoneCountAfterSecond = await prisma.milestone.count({
    where: {
      projectId: first.legacyProjectId,
      promotedFromBuildOpsProjectId: fixture.buildOpsProjectId,
      deletedAt: null,
    },
  });
  const taskCountAfterSecond = await prisma.jobTask.count({
    where: {
      tenantId: fixture.tenantId,
      jobId: fixture.jobId,
      promotedFromBuildOpsProjectId: fixture.buildOpsProjectId,
      deletedAt: null,
    },
  });
  const evidenceCountAfterSecond = await prisma.evidence.count({
    where: {
      projectId: first.legacyProjectId,
      promotedFromBuildOpsProjectId: fixture.buildOpsProjectId,
    },
  });

  assert.equal(milestoneCountAfterSecond, 2);
  assert.equal(taskCountAfterSecond, 2);
  assert.equal(evidenceCountAfterSecond, 1);

  await assert.rejects(
    () =>
      approvalService.unapproveClientPlan({
        tenantId: fixture.tenantId,
        orgId: fixture.clientOrgId,
        userId: fixture.clientUserId,
        roles: ["CLIENT"],
        buildOpsProjectId: fixture.buildOpsProjectId,
        reason: "Demasiado tarde para desaprobar.",
      }),
    /plan already has promoted legacy artifacts/,
  );
});

dbTest("legacy promotion integration blocks plans that are not approved", async (t) => {
  const fixture = await createFixture({ approvalStatus: "changes_requested" });
  t.after(async () => {
    await cleanupFixture({ tenantId: fixture.tenantId, userIds: fixture.userIds });
  });

  const promotionService = new BuildOpsLegacyPromotionService(prisma as never);

  await assert.rejects(
    () =>
      promotionService.promoteApprovedPlanToLegacy({
        tenantId: fixture.tenantId,
        orgId: fixture.clientOrgId,
        userId: fixture.clientUserId,
        roles: ["CLIENT"],
        buildOpsProjectId: fixture.buildOpsProjectId,
      }),
    /BuildOps plan must be approved before legacy promotion/,
  );
});

test.after(async () => {
  await prisma.$disconnect();
});
