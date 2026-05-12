import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { BuildOpsPlanApprovalService } from "../dist/modules/buildops/buildops-plan-approval.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

loadEnv({ path: path.join(repoRoot, "packages/db/.env") });

const prisma = new PrismaClient();

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

async function createFixture() {
  const tenantId = uniqueId("tenant_approval");
  const clientOrgId = uniqueId("org_client");
  const proOrgId = uniqueId("org_pro");
  const clientUserId = uniqueId("usr_client");
  const proUserId = uniqueId("usr_pro");
  const jobId = uniqueId("job_approval");
  const buildOpsProjectId = uniqueId("bop_approval");

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
      title: "Approval integration job",
      category: "Pintura interior",
      scope: "Prepare and paint interior walls.",
      status: "PUBLISHED",
      location: "Miami, FL",
      urgency: "medium",
    },
  });

  await prisma.buildOpsProject.create({
    data: {
      id: buildOpsProjectId,
      tenantId,
      orgId: clientOrgId,
      jobId,
      createdBy: clientUserId,
      title: "BuildOps approval plan",
      description: "Bridge-produced plan ready for client review.",
      trade: "painting",
      projectType: "interior-painting",
      clientName: "Client Org",
      location: "Miami, FL",
      status: "estimating",
      sourceTool: "intake_operations_bridge",
      sourceToolResult: {
        bridgeVersion: 1,
        estimate: {
          status: "ready",
          quoteSummary: {
            total: 1200,
            recommendedDeposit: 360,
            recommendedEscrow: 1200,
            currency: "USD",
          },
        },
        milestonePlan: {
          trade: "painting",
          totalAmount: 1200,
          riskLevel: "medium",
          milestones: [],
          fundingSchedule: [],
        },
        evidenceChecklist: {
          trade: "painting",
          riskLevel: "medium",
          requiredCount: 0,
          items: [],
          notes: [],
        },
        escrowPlan: {
          trade: "painting",
          totalAmount: 1200,
          initialDeposit: 360,
          holdback: 60,
          releaseSchedule: [],
          recommendedReserve: 120,
          notes: [],
        },
        paymentReadiness: {
          status: "draft",
          ready: false,
          checks: {},
          reasons: [],
          reservationId: null,
          contractId: null,
        },
      },
      completion: 15,
    },
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

test("buildops approval integration supports approve idempotency and unapprove before assignment", async (t) => {
  const fixture = await createFixture();
  t.after(async () => {
    await cleanupFixture({ tenantId: fixture.tenantId, userIds: fixture.userIds });
  });

  const service = new BuildOpsPlanApprovalService(prisma as never);

  const firstApprove = await service.approveClientPlan({
    tenantId: fixture.tenantId,
    orgId: fixture.clientOrgId,
    userId: fixture.clientUserId,
    roles: ["CLIENT"],
    buildOpsProjectId: fixture.buildOpsProjectId,
    source: "client",
  });
  assert.equal(firstApprove.clientPlanApprovalStatus, "approved");
  assert.equal(firstApprove.clientPlanApprovalSource, "client");
  assert.ok(firstApprove.clientPlanApprovedAt);

  const secondApprove = await service.approveClientPlan({
    tenantId: fixture.tenantId,
    orgId: fixture.clientOrgId,
    userId: fixture.clientUserId,
    roles: ["CLIENT"],
    buildOpsProjectId: fixture.buildOpsProjectId,
    source: "client",
  });
  assert.equal(secondApprove.clientPlanApprovedAt, firstApprove.clientPlanApprovedAt);

  const unapproved = await service.unapproveClientPlan({
    tenantId: fixture.tenantId,
    orgId: fixture.clientOrgId,
    userId: fixture.clientUserId,
    roles: ["CLIENT"],
    buildOpsProjectId: fixture.buildOpsProjectId,
    reason: "Necesito revisar el alcance una vez mas.",
  });
  assert.equal(unapproved.clientPlanApprovalStatus, "pending");
  assert.equal(unapproved.clientPlanApprovedAt, null);
});

test("buildops approval integration blocks unapprove after accepted reservation", async (t) => {
  const fixture = await createFixture();
  t.after(async () => {
    await cleanupFixture({ tenantId: fixture.tenantId, userIds: fixture.userIds });
  });

  const service = new BuildOpsPlanApprovalService(prisma as never);

  await service.approveClientPlan({
    tenantId: fixture.tenantId,
    orgId: fixture.clientOrgId,
    userId: fixture.clientUserId,
    roles: ["CLIENT"],
    buildOpsProjectId: fixture.buildOpsProjectId,
    source: "client",
  });

  await prisma.jobReservation.create({
    data: {
      id: uniqueId("res"),
      jobId: fixture.jobId,
      professionalOrgId: fixture.proOrgId,
      professionalId: fixture.proUserId,
      status: "ACCEPTED",
      reservedAt: new Date(),
      expiresAt: new Date(),
      acceptedAt: new Date(),
    },
  });

  await prisma.project.create({
    data: {
      tenantId: fixture.tenantId,
      jobId: fixture.jobId,
      assignedProOrgId: fixture.proOrgId,
      status: "OPEN",
    },
  });

  await assert.rejects(
    () =>
      service.unapproveClientPlan({
        tenantId: fixture.tenantId,
        orgId: fixture.clientOrgId,
        userId: fixture.clientUserId,
        roles: ["CLIENT"],
        buildOpsProjectId: fixture.buildOpsProjectId,
        reason: "Demasiado tarde para desaprobar.",
      }),
    /reservation already accepted/,
  );
});

test("buildops approval integration transitions approved plan to changes_requested before assignment", async (t) => {
  const fixture = await createFixture();
  t.after(async () => {
    await cleanupFixture({ tenantId: fixture.tenantId, userIds: fixture.userIds });
  });

  const service = new BuildOpsPlanApprovalService(prisma as never);

  await service.approveClientPlan({
    tenantId: fixture.tenantId,
    orgId: fixture.clientOrgId,
    userId: fixture.clientUserId,
    roles: ["CLIENT"],
    buildOpsProjectId: fixture.buildOpsProjectId,
    source: "client",
  });

  const result = await service.requestChanges({
    tenantId: fixture.tenantId,
    orgId: fixture.clientOrgId,
    userId: fixture.clientUserId,
    roles: ["CLIENT"],
    buildOpsProjectId: fixture.buildOpsProjectId,
    comment: "Incluye proteccion adicional para muebles y molduras.",
  });

  assert.equal(result.clientPlanApprovalStatus, "changes_requested");
  assert.equal(result.clientPlanApprovedAt, null);
  assert.equal(result.clientPlanReviewComment, "Incluye proteccion adicional para muebles y molduras.");
});

test.after(async () => {
  await prisma.$disconnect();
});
