#!/usr/bin/env node
/**
 * Smoke test: POST /v1/buildops/plans/:id/rerun-bridge
 *
 * Usage:
 *   node scripts/buildops-rerun-bridge-smoke.mjs
 *
 * Variables:
 *   SEMSE_API_URL    — base URL (default: http://127.0.0.1:4000)
 *   DATABASE_URL     — Postgres URL (default: from packages/db/.env)
 *
 * Exit code 0 if all checks pass, 1 if any fail.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

loadEnv({ path: path.join(repoRoot, "packages/db/.env") });

const apiBaseUrl = (process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000").replace(/\/+$/, "");
const prisma = new PrismaClient();

// ── result tracking ───────────────────────────────────────────────────────────

const results = [];

function pass(label) {
  results.push({ ok: true, label });
  console.log(`  ✅  PASS  ${label}`);
}

function fail(label, reason) {
  results.push({ ok: false, label, reason });
  console.error(`  ❌  FAIL  ${label}`);
  console.error(`            ${reason}`);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readJson(resp) {
  const text = await resp.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* ok */ }
  return { status: resp.status, text, json };
}

async function api(method, path, actor, body) {
  const headers = {
    "x-tenant-id": actor.tenantId,
    "x-org-id": actor.orgId,
    "x-user-id": actor.userId,
    "x-roles": actor.roles.join(","),
  };
  if (body) headers["content-type"] = "application/json";
  const resp = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return readJson(resp);
}

function rerunUrl(id) {
  return `/v1/buildops/plans/${encodeURIComponent(id)}/rerun-bridge`;
}

// ── fixture ───────────────────────────────────────────────────────────────────

function buildSourceToolResult(note = "initial plan") {
  return {
    schemaVersion: "1.0",
    bridgeVersion: 1,
    note,
    estimate: {
      status: "ready",
      scopeSummary: "Paint living room and hallway.",
      missingInputs: [],
      tool: "painting",
      quoteSummary: { total: 1500, recommendedDeposit: 450, recommendedEscrow: 1500, currency: "USD" },
    },
    milestonePlan: {
      trade: "painting",
      totalAmount: 1500,
      riskLevel: "medium",
      milestones: [
        {
          sequence: 1,
          title: "Scope confirmation",
          description: "Confirm measurements and prep.",
          percentage: 40,
          amount: 600,
          evidenceRequired: ["before_photos"],
          releaseTrigger: "client_signoff",
        },
        {
          sequence: 2,
          title: "Execution",
          description: "Complete paint work.",
          percentage: 60,
          amount: 900,
          evidenceRequired: ["after_photos"],
          releaseTrigger: "client_signoff",
        },
      ],
      fundingSchedule: [600, 900],
    },
    evidenceChecklist: {
      trade: "painting",
      riskLevel: "medium",
      requiredCount: 2,
      items: [
        { type: "photo", description: "Before photos", required: true, milestone: 1 },
        { type: "photo", description: "After photos", required: true, milestone: 2 },
      ],
      notes: [],
    },
    paymentReadiness: {
      status: "draft",
      ready: false,
      checks: { acceptedReservation: false },
      reasons: ["Contract pending"],
      reservationId: null,
      contractId: null,
    },
  };
}

async function seedFixture(approvalStatus = "changes_requested") {
  const tenantId = uid("t_rr_smoke");
  const clientOrgId = uid("org_cli");
  const adminOrgId = uid("org_adm");
  const clientUserId = uid("usr_cli");
  const adminUserId = uid("usr_adm");
  const jobId = uid("job_rr");
  const bopId = uid("bop_rr");

  await prisma.tenant.create({
    data: { id: tenantId, slug: uid("slug"), name: `Smoke ${tenantId}`, status: "active" },
  });

  await prisma.org.createMany({
    data: [
      { id: clientOrgId, tenantId, type: "client", name: "Client Org" },
      { id: adminOrgId, tenantId, type: "admin", name: "Admin Org" },
    ],
  });

  await prisma.user.createMany({
    data: [
      { id: clientUserId, email: `${clientUserId}@smoke.test`, status: "active" },
      { id: adminUserId, email: `${adminUserId}@smoke.test`, status: "active" },
    ],
  });

  await prisma.job.create({
    data: {
      id: jobId,
      tenantId,
      clientOrgId,
      title: "Smoke rerun job",
      category: "Pintura interior",
      scope: "Paint living room and hallway.",
      status: "PUBLISHED",
      location: "Miami, FL",
      urgency: "medium",
    },
  });

  await prisma.projectIntake.create({
    data: {
      id: uid("intake"),
      tenantId,
      userId: clientUserId,
      publishedJobId: jobId,
      rawDescription: "Paint living room and hallway with prep and cleanup.",
      normalizedTitle: "Paint living room and hallway",
      detectedCategory: "interior_painting",
      uploadedImagesJson: [],
      projectScopeJson: { area: { value: 420 }, paintCoats: { value: 2 } },
      generatedEstimateJson: {
        assumptions: [],
        confidenceReasons: [],
        totalRange: { min: 1500, max: 1800 },
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
          description: { en: "Complete paint work." },
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
      id: bopId,
      tenantId,
      orgId: clientOrgId,
      jobId,
      createdBy: clientUserId,
      title: "Smoke rerun plan",
      description: "Existing plan before rerun.",
      trade: "painting",
      projectType: "interior-painting",
      clientName: "Client Org",
      location: "Miami, FL",
      status: "estimating",
      sourceTool: "intake_operations_bridge",
      sourceToolInput: { sourceKind: "smart_intake", jobId },
      sourceToolResult: buildSourceToolResult(),
      clientPlanApprovalStatus: approvalStatus,
      clientPlanReviewedAt:
        approvalStatus === "changes_requested"
          ? new Date("2026-05-12T16:00:00.000Z")
          : approvalStatus === "approved"
          ? new Date("2026-05-12T17:00:00.000Z")
          : approvalStatus === "rejected"
          ? new Date("2026-05-12T18:00:00.000Z")
          : null,
      clientPlanReviewComment:
        approvalStatus === "changes_requested" ? "Reduce prep and refresh milestone plan." : null,
      completion: 15,
    },
  });

  return {
    tenantId,
    clientOrgId,
    adminOrgId,
    clientUserId,
    adminUserId,
    jobId,
    bopId,
    userIds: [clientUserId, adminUserId],
    adminActor: { tenantId, orgId: adminOrgId, userId: adminUserId, roles: ["OPS_ADMIN"] },
    clientActor: { tenantId, orgId: clientOrgId, userId: clientUserId, roles: ["CLIENT"] },
  };
}

async function cleanup(tenantId, userIds) {
  await prisma.milestone.deleteMany({ where: { project: { tenantId } } });
  await prisma.evidence.deleteMany({ where: { project: { tenantId } } });
  await prisma.paymentTxn.deleteMany({ where: { escrow: { project: { tenantId } } } });
  await prisma.paymentEscrow.deleteMany({
    where: { OR: [{ project: { tenantId } }, { job: { tenantId } }] },
  });
  await prisma.jobTask.deleteMany({ where: { tenantId } });
  await prisma.buildOpsPlanVersion.deleteMany({ where: { tenantId } });
  await prisma.project.deleteMany({ where: { tenantId } });
  await prisma.jobReservation.deleteMany({ where: { job: { tenantId } } });
  await prisma.contract.deleteMany({ where: { job: { tenantId } } });
  await prisma.buildOpsTask.deleteMany({ where: { tenantId } });
  await prisma.buildOpsProject.deleteMany({ where: { tenantId } });
  await prisma.projectIntake.deleteMany({ where: { tenantId } });
  await prisma.job.deleteMany({ where: { tenantId } });
  await prisma.membership.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.org.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

// ── checks ────────────────────────────────────────────────────────────────────

async function checkHappyPath(fixture) {
  const label = "happy path — changes_requested → rerun_completed";
  const resp = await api("POST", rerunUrl(fixture.bopId), fixture.adminActor);
  if (resp.status !== 200 && resp.status !== 201) {
    fail(label, `Expected 200/201, got ${resp.status}: ${resp.text}`);
    return null;
  }
  const data = resp.json?.data;
  if (data?.status !== "rerun_completed") {
    fail(label, `Expected status=rerun_completed, got: ${JSON.stringify(data)}`);
    return null;
  }
  if (data?.approvalStatus !== "pending") {
    fail(label, `Expected approvalStatus=pending after rerun, got: ${data?.approvalStatus}`);
    return null;
  }
  pass(label);
  return data;
}

async function checkVersionHistory(fixture) {
  const label = "version history — v1 superseded, v2 active";
  const versions = await prisma.buildOpsPlanVersion.findMany({
    where: { tenantId: fixture.tenantId, buildOpsProjectId: fixture.bopId },
    orderBy: { versionNumber: "asc" },
    select: { versionNumber: true, status: true, previousVersionId: true },
  });

  if (versions.length !== 2) {
    fail(label, `Expected 2 versions, found ${versions.length}`);
    return;
  }
  if (versions[0].status !== "superseded") {
    fail(label, `v1 status should be 'superseded', got '${versions[0].status}'`);
    return;
  }
  if (versions[1].status !== "active") {
    fail(label, `v2 status should be 'active', got '${versions[1].status}'`);
    return;
  }
  if (!versions[1].previousVersionId) {
    fail(label, "v2 should have previousVersionId set (traceability)");
    return;
  }
  pass(label);
}

async function checkPlanResetToPending(fixture) {
  const label = "plan approval status reset to pending after rerun";
  const plan = await prisma.buildOpsProject.findUnique({ where: { id: fixture.bopId } });
  if (plan?.clientPlanApprovalStatus !== "pending") {
    fail(label, `Expected 'pending', got '${plan?.clientPlanApprovalStatus}'`);
    return;
  }
  if (plan?.clientPlanApprovedAt !== null) {
    fail(label, "clientPlanApprovedAt should be null after rerun");
    return;
  }
  pass(label);
}

async function checkNoLegacyPromotion(fixture) {
  const label = "no legacy promotion after rerun";
  const [projects, milestones, tasks] = await Promise.all([
    prisma.project.count({ where: { tenantId: fixture.tenantId, promotedFromBuildOpsProjectId: fixture.bopId } }),
    prisma.milestone.count({ where: { project: { tenantId: fixture.tenantId }, promotedFromBuildOpsProjectId: fixture.bopId } }),
    prisma.jobTask.count({ where: { tenantId: fixture.tenantId, promotedFromBuildOpsProjectId: fixture.bopId } }),
  ]);
  if (projects + milestones + tasks > 0) {
    fail(label, `Unexpected legacy artifacts: projects=${projects} milestones=${milestones} tasks=${tasks}`);
    return;
  }
  pass(label);
}

async function checkBlockOnPending(fixture) {
  const label = "blocked when approvalStatus=pending (not changes_requested)";
  const resp = await api("POST", rerunUrl(fixture.bopId), fixture.adminActor);
  if (resp.status !== 409) {
    fail(label, `Expected 409, got ${resp.status}: ${resp.text}`);
    return;
  }
  pass(label);
}

async function checkBlockOnApproved() {
  const label = "blocked when approvalStatus=approved";
  const fx = await seedFixture("approved");
  try {
    const resp = await api("POST", rerunUrl(fx.bopId), fx.adminActor);
    if (resp.status !== 409) {
      fail(label, `Expected 409, got ${resp.status}: ${resp.text}`);
    } else {
      pass(label);
    }
  } finally {
    await cleanup(fx.tenantId, fx.userIds);
  }
}

async function checkBlockOnRejected() {
  const label = "blocked when approvalStatus=rejected";
  const fx = await seedFixture("rejected");
  try {
    const resp = await api("POST", rerunUrl(fx.bopId), fx.adminActor);
    if (resp.status !== 409) {
      fail(label, `Expected 409, got ${resp.status}: ${resp.text}`);
    } else {
      pass(label);
    }
  } finally {
    await cleanup(fx.tenantId, fx.userIds);
  }
}

async function checkBlockOnNonExistent(fixture) {
  const label = "blocked for non-existent buildOpsProjectId";
  const fakeId = uid("bop_nonexistent");
  const resp = await api("POST", rerunUrl(fakeId), fixture.adminActor);
  if (resp.status !== 404) {
    fail(label, `Expected 404, got ${resp.status}: ${resp.text}`);
    return;
  }
  pass(label);
}

async function checkBlockWithoutOpsAdmin(fixture) {
  const label = "blocked without OPS_ADMIN role";
  // Use a client actor on a fresh changes_requested plan
  const fx2 = await seedFixture("changes_requested");
  try {
    const resp = await api("POST", rerunUrl(fx2.bopId), fx2.clientActor);
    if (resp.status !== 403) {
      fail(label, `Expected 403, got ${resp.status}: ${resp.text}`);
    } else {
      pass(label);
    }
  } finally {
    await cleanup(fx2.tenantId, fx2.userIds);
  }
}

async function checkBlockOnPromoted(fixture) {
  const label = "blocked when legacyPromotionStatus=promoted";
  // Force-set promoted flag
  await prisma.buildOpsProject.update({
    where: { id: fixture.bopId },
    data: { clientPlanApprovalStatus: "changes_requested", legacyPromotionStatus: "promoted" },
  });
  const resp = await api("POST", rerunUrl(fixture.bopId), fixture.adminActor);
  if (resp.status !== 409) {
    fail(label, `Expected 409, got ${resp.status}: ${resp.text}`);
  } else {
    pass(label);
  }
}

async function checkTasksCreated(rerunData) {
  const label = "tasks created after rerun (tasksCreated > 0)";
  if (typeof rerunData?.tasksCreated !== "number" || rerunData.tasksCreated === 0) {
    fail(label, `Expected tasksCreated > 0, got ${rerunData?.tasksCreated}`);
    return;
  }
  pass(label);
}

async function checkVersionTraceability(fixture, rerunData) {
  const label = "traceability — sourceToolResult set on active version";
  const activeVersion = await prisma.buildOpsPlanVersion.findFirst({
    where: { tenantId: fixture.tenantId, buildOpsProjectId: fixture.bopId, status: "active" },
  });
  if (!activeVersion?.sourceToolResultJson) {
    fail(label, "active version missing sourceToolResultJson");
    return;
  }
  if (activeVersion.id !== rerunData?.activeVersionId) {
    fail(label, `active version id mismatch: ${activeVersion.id} vs ${rerunData?.activeVersionId}`);
    return;
  }
  pass(label);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nSMOKE: rerun-bridge  →  ${apiBaseUrl}\n`);

  // Health check
  try {
    const health = await fetch(`${apiBaseUrl}/v1/health`);
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
  } catch (e) {
    console.error(`API not reachable at ${apiBaseUrl}: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  // Parallel negative cases (independent fixtures)
  const [blockApproved, blockRejected] = await Promise.all([
    checkBlockOnApproved(),
    checkBlockOnRejected(),
  ]);

  // Primary fixture — happy path + most negative cases
  const fixture = await seedFixture("changes_requested");

  try {
    await checkBlockOnNonExistent(fixture);
    await checkBlockWithoutOpsAdmin(fixture);

    const rerunData = await checkHappyPath(fixture);

    if (rerunData) {
      await checkVersionHistory(fixture);
      await checkPlanResetToPending(fixture);
      await checkNoLegacyPromotion(fixture);
      await checkTasksCreated(rerunData);
      await checkVersionTraceability(fixture, rerunData);
      await checkBlockOnPending(fixture); // now pending → must reject
    }

    await checkBlockOnPromoted(fixture);
  } finally {
    await cleanup(fixture.tenantId, fixture.userIds);
    await prisma.$disconnect();
  }

  // Summary
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${passed}/${results.length} checks passed`);
  if (failed > 0) {
    console.log(`\nFailed checks:`);
    for (const r of results.filter((r) => !r.ok)) {
      console.log(`  ❌  ${r.label}`);
      console.log(`      ${r.reason}`);
    }
    console.log(`\nResult: FAIL`);
    process.exitCode = 1;
  } else {
    console.log(`\nResult: PASS`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
