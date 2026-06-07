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
    "content-type": "application/json",
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
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method,
    headers: actorHeaders(actor),
    body: body ? JSON.stringify(body) : undefined,
  });
  return readJson(response);
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
  const adminOrgId = uniqueId("org_admin");
  const clientUserId = uniqueId("usr_client");
  const adminUserId = uniqueId("usr_admin");
  const otherUserId = uniqueId("usr_other");
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
      { id: adminOrgId, tenantId, type: "admin", name: "Admin Org" },
    ],
  });

  await prisma.user.createMany({
    data: [
      { id: clientUserId, email: `${clientUserId}@example.com`, status: "active" },
      { id: adminUserId, email: `${adminUserId}@example.com`, status: "active" },
      { id: otherUserId, email: `${otherUserId}@example.com`, status: "active" },
      { id: proUserId, email: `${proUserId}@example.com`, status: "active" },
    ],
  });

  await prisma.job.create({
    data: {
      id: jobId,
      tenantId,
      clientOrgId,
      title: "Smoke BuildOps approval job",
      category: "Pintura interior",
      scope: "Paint living room and protect furniture.",
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
      title: "Smoke plan",
      description: "Plan pending client approval.",
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
            total: 1250,
            recommendedDeposit: 375,
            recommendedEscrow: 1250,
            currency: "USD",
          },
        },
        milestonePlan: {
          trade: "painting",
          totalAmount: 1250,
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
          totalAmount: 1250,
          initialDeposit: 375,
          holdback: 62.5,
          releaseSchedule: [],
          recommendedReserve: 125,
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
    adminOrgId,
    clientUserId,
    adminUserId,
    otherUserId,
    proUserId,
    jobId,
    buildOpsProjectId,
    userIds: [clientUserId, adminUserId, otherUserId, proUserId],
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
    const adminActor = {
      tenantId: fixture.tenantId,
      orgId: fixture.adminOrgId,
      userId: fixture.adminUserId,
      roles: ["OPS_ADMIN"],
    };
    const otherActor = {
      tenantId: fixture.tenantId,
      orgId: fixture.proOrgId,
      userId: fixture.otherUserId,
      roles: ["PRO"],
    };

    const unauthorizedApprove = await api(
      "POST",
      `/v1/buildops/plans/${encodeURIComponent(fixture.buildOpsProjectId)}/approve`,
      otherActor,
      { source: "client" },
    );
    assert.equal(unauthorizedApprove.status, 403, unauthorizedApprove.text);

    const clientApprove = await api(
      "POST",
      `/v1/buildops/plans/${encodeURIComponent(fixture.buildOpsProjectId)}/approve`,
      clientActor,
      { source: "client" },
    );
    assert.equal(clientApprove.status, 200, clientApprove.text);
    const firstApprovedAt = clientApprove.json?.data?.clientPlanApprovedAt;
    assert.equal(clientApprove.json?.data?.clientPlanApprovalStatus, "approved");

    const secondApprove = await api(
      "POST",
      `/v1/buildops/plans/${encodeURIComponent(fixture.buildOpsProjectId)}/approve`,
      clientActor,
      { source: "client" },
    );
    assert.equal(secondApprove.status, 200, secondApprove.text);
    assert.equal(secondApprove.json?.data?.clientPlanApprovedAt, firstApprovedAt);

    const unapprove = await api(
      "POST",
      `/v1/buildops/plans/${encodeURIComponent(fixture.buildOpsProjectId)}/unapprove`,
      clientActor,
      { reason: "Necesito revisar el alcance antes de seguir." },
    );
    assert.equal(unapprove.status, 200, unapprove.text);
    assert.equal(unapprove.json?.data?.clientPlanApprovalStatus, "pending");

    const adminApproveWithoutReason = await api(
      "POST",
      `/v1/buildops/plans/${encodeURIComponent(fixture.buildOpsProjectId)}/approve`,
      adminActor,
      { source: "admin_override" },
    );
    assert.equal(adminApproveWithoutReason.status, 400, adminApproveWithoutReason.text);

    const adminApprove = await api(
      "POST",
      `/v1/buildops/plans/${encodeURIComponent(fixture.buildOpsProjectId)}/approve`,
      adminActor,
      { source: "admin_override", reason: "Override operativo validado por admin." },
    );
    assert.equal(adminApprove.status, 200, adminApprove.text);
    assert.equal(adminApprove.json?.data?.clientPlanApprovalSource, "admin_override");

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

    const blockedUnapprove = await api(
      "POST",
      `/v1/buildops/plans/${encodeURIComponent(fixture.buildOpsProjectId)}/unapprove`,
      clientActor,
      { reason: "Too late" },
    );
    assert.equal(blockedUnapprove.status, 403, blockedUnapprove.text);

    const blockedChanges = await api(
      "POST",
      `/v1/buildops/plans/${encodeURIComponent(fixture.buildOpsProjectId)}/request-changes`,
      clientActor,
      { comment: "Quiero otro ajuste." },
    );
    assert.equal(blockedChanges.status, 403, blockedChanges.text);

    console.log(JSON.stringify({
      ok: true,
      apiBaseUrl,
      buildOpsProjectId: fixture.buildOpsProjectId,
      clientApprovedAt: firstApprovedAt,
      adminOverrideApproved: adminApprove.json?.data?.clientPlanApprovalSource,
      blockedAfterAcceptedReservation: {
        unapproveStatus: blockedUnapprove.status,
        requestChangesStatus: blockedChanges.status,
      },
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
