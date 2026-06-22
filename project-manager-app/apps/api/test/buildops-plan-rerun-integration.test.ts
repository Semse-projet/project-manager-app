import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { BuildOpsLegacyPromotionService } from "../dist/modules/buildops/buildops-legacy-promotion.service.js";
import { BuildOpsPlanApprovalService } from "../dist/modules/buildops/buildops-plan-approval.service.js";
import { BuildOpsPlanRerunService } from "../dist/modules/buildops/buildops-plan-rerun.service.js";

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
  await prisma.buildOpsPlanVersion.deleteMany({
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

function createFakeBridge(prismaClient: PrismaClient) {
  return {
    computeBridgePlan: async ({ buildOpsProjectId, rerunContext }: { buildOpsProjectId?: string; rerunContext?: { clientPlanReviewComment?: string | null } }) => ({
      jobId: "unused_job_id",
      projectIntakeId: "unused_intake_id",
      projectPatch: {
        title: "Rerun bridge plan",
        description: `Updated after changes: ${rerunContext?.clientPlanReviewComment ?? "none"}`,
        trade: "painting",
        projectType: "interior-painting",
        clientName: "Client Org",
        location: "Miami, FL",
        budgetEstimate: 1600,
        status: "estimating",
        riskScore: 28,
        riskLevel: "medium",
        sourceTool: "intake_operations_bridge",
        completion: 15,
      },
      sourceToolInput: {
        sourceKind: "smart_intake",
        buildOpsProjectId: buildOpsProjectId ?? null,
        rerunContext: rerunContext ?? null,
      },
      sourceToolResult: {
        schemaVersion: "1.0",
        bridgeVersion: 1,
        estimate: {
          status: "ready",
          scopeSummary: "Updated rerun scope after client feedback.",
          missingInputs: [],
          tool: "painting",
          quoteSummary: {
            materials: 380,
            labor: 720,
            overhead: 70,
            profit: 110,
            semseFee: 80,
            contingency: 90,
            taxes: 50,
            subtotal: 1500,
            total: 1600,
            recommendedDeposit: 480,
            recommendedEscrow: 1600,
            currency: "USD",
            notes: [],
          },
        },
        milestonePlan: {
          trade: "painting",
          totalAmount: 1600,
          riskLevel: "medium",
          milestones: [
            {
              sequence: 1,
              title: "Scope confirmation",
              description: "Confirm revised surfaces and prep scope.",
              percentage: 35,
              amount: 560,
              evidenceRequired: ["before_photos", "measurements"],
              releaseTrigger: "scope_confirmed",
            },
            {
              sequence: 2,
              title: "Execution",
              description: "Complete prep and painting under revised scope.",
              percentage: 65,
              amount: 1040,
              evidenceRequired: ["progress_photos", "after_photos", "client_approval"],
              releaseTrigger: "client_signoff",
            },
          ],
          fundingSchedule: [560, 1040],
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
              description: "Updated wall measurements",
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
        warnings: [],
        recommendations: [],
      },
      taskTemplates: [
        {
          templateKey: "review_client_request",
          title: "Review updated client request",
          description: "Review revised scope before approval.",
          priority: "medium",
          evidenceRequired: { checklist: ["scope_summary"] },
        },
        {
          templateKey: "define_milestones_payment_plan",
          title: "Refresh milestones and payment plan",
          description: "Align the revised scope with milestones.",
          priority: "high",
          evidenceRequired: { checklist: ["milestone_plan"] },
        },
      ],
      estimate: {
        status: "ready",
        scopeSummary: "Updated rerun scope after client feedback.",
        missingInputs: [],
        tool: "painting",
        quoteTotal: 1600,
      },
      matching: {
        status: "ready",
        candidatesEvaluated: 1,
        candidateCount: 1,
        topCandidates: [],
        preferredCandidateStatus: null,
        algorithmVersion: null,
        computedAt: null,
      },
      milestones: {
        count: 2,
        items: [],
      },
      evidenceRequirements: {
        count: 3,
        items: [],
      },
      paymentReadiness: {
        status: "draft",
        ready: false,
        reason: "Contract pending",
        suggestedDeposit: 480,
        suggestedEscrow: 1600,
        checks: {
          acceptedReservation: true,
        },
      },
    }),
    syncProjectedBuildOpsTasks: async (input: {
      tenantId: string;
      orgId: string;
      userId: string;
      buildOpsProjectId: string;
      taskTemplates: Array<{
        templateKey: string;
        title: string;
        description: string;
        priority: string;
        evidenceRequired: Record<string, unknown>;
      }>;
      tx?: Pick<PrismaClient, "buildOpsTask">;
    }) => {
      const db = input.tx ?? prismaClient;
      const existing = await db.buildOpsTask.findMany({
        where: {
          tenantId: input.tenantId,
          projectId: input.buildOpsProjectId,
          templateKey: { not: null },
        },
        select: {
          id: true,
          templateKey: true,
        },
      });

      const byTemplate = new Map(
        existing
          .filter((task): task is typeof task & { templateKey: string } => typeof task.templateKey === "string")
          .map((task) => [task.templateKey, task]),
      );

      let tasksCreated = 0;
      let tasksReused = 0;
      const taskIds: string[] = [];

      for (const template of input.taskTemplates) {
        const found = byTemplate.get(template.templateKey);
        if (found) {
          await db.buildOpsTask.update({
            where: { id: found.id },
            data: {
              title: template.title,
              description: template.description,
              priority: template.priority,
              sourceTool: "intake_operations_bridge",
              evidenceRequired: template.evidenceRequired,
            },
          });
          taskIds.push(found.id);
          tasksReused += 1;
          continue;
        }

        const created = await db.buildOpsTask.create({
          data: {
            tenantId: input.tenantId,
            orgId: input.orgId,
            projectId: input.buildOpsProjectId,
            templateKey: template.templateKey,
            createdBy: input.userId,
            title: template.title,
            description: template.description,
            priority: template.priority,
            sourceTool: "intake_operations_bridge",
            evidenceRequired: template.evidenceRequired,
          },
          select: {
            id: true,
          },
        });
        taskIds.push(created.id);
        tasksCreated += 1;
      }

      return {
        taskIds,
        tasksCreated,
        tasksReused,
      };
    },
  };
}

async function createFixture() {
  const tenantId = uniqueId("tenant_rerun");
  const clientOrgId = uniqueId("org_client");
  const proOrgId = uniqueId("org_pro");
  const adminOrgId = uniqueId("org_admin");
  const clientUserId = uniqueId("usr_client");
  const proUserId = uniqueId("usr_pro");
  const adminUserId = uniqueId("usr_admin");
  const jobId = uniqueId("job_rerun");
  const buildOpsProjectId = uniqueId("bop_rerun");

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
      title: "Rerun integration job",
      category: "Pintura interior",
      scope: "Prepare and paint the living room and hallway.",
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
      title: "BuildOps rerun plan",
      description: "Original plan before requested changes.",
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
          scopeSummary: "Original scope before requested changes.",
          missingInputs: [],
          tool: "painting",
          quoteSummary: {
            total: 1400,
            recommendedDeposit: 420,
            recommendedEscrow: 1400,
            currency: "USD",
          },
        },
        milestonePlan: {
          trade: "painting",
          totalAmount: 1400,
          riskLevel: "medium",
          milestones: [
            {
              sequence: 1,
              title: "Original milestone",
              description: "Original description",
              percentage: 100,
              amount: 1400,
              evidenceRequired: ["before_photos"],
              releaseTrigger: "client_signoff",
            },
          ],
          fundingSchedule: [1400],
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
            acceptedReservation: true,
          },
          reasons: ["Contract pending"],
          reservationId: null,
          contractId: null,
        },
      },
      clientPlanApprovalStatus: "changes_requested",
      clientPlanReviewedAt: new Date("2026-05-12T15:00:00.000Z"),
      clientPlanReviewComment: "Reduce prep and refresh milestone plan.",
      completion: 15,
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

  return {
    tenantId,
    clientOrgId,
    proOrgId,
    adminOrgId,
    clientUserId,
    proUserId,
    adminUserId,
    jobId,
    buildOpsProjectId,
    userIds: [clientUserId, proUserId, adminUserId],
  };
}

dbTest("buildops rerun integration supports changes_requested -> rerun -> approve -> promote legacy", async () => {
  const fixture = await createFixture();
  try {
    const rerunService = new BuildOpsPlanRerunService(
      prisma as never,
      createFakeBridge(prisma) as never,
    );
    const approvalService = new BuildOpsPlanApprovalService(prisma as never);
    const legacyPromotionService = new BuildOpsLegacyPromotionService(prisma as never);

    const rerun = await rerunService.rerunBridge({
      tenantId: fixture.tenantId,
      orgId: fixture.adminOrgId,
      userId: fixture.adminUserId,
      roles: ["OPS_ADMIN"],
      buildOpsProjectId: fixture.buildOpsProjectId,
    });

    assert.equal(rerun.activeVersionNumber, 2);
    assert.equal(rerun.previousVersionNumber, 1);

    const versions = await prisma.buildOpsPlanVersion.findMany({
      where: {
        tenantId: fixture.tenantId,
        buildOpsProjectId: fixture.buildOpsProjectId,
      },
      orderBy: {
        versionNumber: "asc",
      },
    });

    assert.equal(versions.length, 2);
    assert.deepEqual(
      versions.map((version) => ({ versionNumber: version.versionNumber, status: version.status })),
      [
        { versionNumber: 1, status: "superseded" },
        { versionNumber: 2, status: "active" },
      ],
    );

    const pendingPlan = await prisma.buildOpsProject.findUniqueOrThrow({
      where: {
        id: fixture.buildOpsProjectId,
      },
    });
    assert.equal(pendingPlan.clientPlanApprovalStatus, "pending");
    assert.match(JSON.stringify(pendingPlan.sourceToolResult), /Updated rerun scope after client feedback/);

    const approved = await approvalService.approveClientPlan({
      tenantId: fixture.tenantId,
      orgId: fixture.clientOrgId,
      userId: fixture.clientUserId,
      roles: ["CLIENT"],
      buildOpsProjectId: fixture.buildOpsProjectId,
      source: "client",
    });
    assert.equal(approved.clientPlanApprovalStatus, "approved");

    const promoted = await legacyPromotionService.promoteApprovedPlanToLegacy({
      tenantId: fixture.tenantId,
      orgId: fixture.clientOrgId,
      userId: fixture.clientUserId,
      roles: ["CLIENT"],
      buildOpsProjectId: fixture.buildOpsProjectId,
    });

    assert.equal(promoted.status, "promoted");
    assert.equal(promoted.alreadyPromoted, false);
    assert.equal(promoted.milestonesCreated, 2);
    assert.equal(promoted.tasksCreated, 2);
    assert.equal(promoted.evidenceCreated, 1);
  } finally {
    await cleanupFixture({
      tenantId: fixture.tenantId,
      userIds: fixture.userIds,
    });
  }
});

dbTest("buildops rerun integration blocks plans that already promoted legacy artifacts even if status drifts back to changes_requested", async () => {
  const fixture = await createFixture();
  try {
    const legacyPromotionService = new BuildOpsLegacyPromotionService(prisma as never);
    const rerunService = new BuildOpsPlanRerunService(
      prisma as never,
      createFakeBridge(prisma) as never,
    );

    await prisma.buildOpsProject.update({
      where: { id: fixture.buildOpsProjectId },
      data: {
        clientPlanApprovalStatus: "approved",
        clientPlanApprovedAt: new Date("2026-05-12T17:00:00.000Z"),
        clientPlanApprovedById: fixture.clientUserId,
        clientPlanApprovalSource: "client",
      },
    });

    await legacyPromotionService.promoteApprovedPlanToLegacy({
      tenantId: fixture.tenantId,
      orgId: fixture.clientOrgId,
      userId: fixture.clientUserId,
      roles: ["CLIENT"],
      buildOpsProjectId: fixture.buildOpsProjectId,
    });

    await prisma.buildOpsProject.update({
      where: { id: fixture.buildOpsProjectId },
      data: {
        clientPlanApprovalStatus: "changes_requested",
        clientPlanReviewedAt: new Date("2026-05-12T18:00:00.000Z"),
        clientPlanReviewComment: "Simulated drift after promotion.",
      },
    });

    await assert.rejects(
      () =>
        rerunService.rerunBridge({
          tenantId: fixture.tenantId,
          orgId: fixture.adminOrgId,
          userId: fixture.adminUserId,
          roles: ["OPS_ADMIN"],
          buildOpsProjectId: fixture.buildOpsProjectId,
        }),
      /already has promoted legacy artifacts/,
    );
  } finally {
    await cleanupFixture({
      tenantId: fixture.tenantId,
      userIds: fixture.userIds,
    });
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
