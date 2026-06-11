#!/usr/bin/env node
/**
 * E2E smoke: intake → answer questions → estimate → publish job → bridge → BuildOpsProject
 *
 * Tests the full monetizable pipeline for non-painting categories:
 *   bathroom_remodel, drywall_repair, cleaning
 *
 * Usage:
 *   node scripts/intake-to-buildops-smoke.mjs
 *
 * Variables:
 *   SEMSE_API_URL   (default: http://127.0.0.1:4000)
 *   DATABASE_URL    (for seed/cleanup via Prisma)
 */
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
loadEnv({ path: path.join(repoRoot, "packages/db/.env") });

const BASE = (process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000").replace(/\/+$/, "");
const prisma = new PrismaClient();

// ── result tracking ─────────────────────────────────────────────────────────

const results = [];
const pass = (label) => { results.push({ ok: true, label }); console.log(`  ✅  ${label}`); };
const fail = (label, reason) => { results.push({ ok: false, label, reason }); console.error(`  ❌  ${label}\n      ${reason}`); };

function uid(p) { return `${p}_${randomUUID().replaceAll("-", "").slice(0, 12)}`; }

// ── HTTP helpers ─────────────────────────────────────────────────────────────

async function api(method, path, { sessionToken, actorHeaders, body } = {}) {
  const headers = { "content-type": "application/json" };
  if (sessionToken) headers["x-session-token"] = sessionToken;
  if (actorHeaders) Object.assign(headers, actorHeaders);
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* ok */ }
  return { status: res.status, json, text };
}

function opsActor(tenantId, orgId, userId) {
  return {
    "x-tenant-id": tenantId,
    "x-org-id": orgId,
    "x-user-id": userId,
    "x-roles": "OPS_ADMIN",
  };
}

// ── DB seed helpers ──────────────────────────────────────────────────────────

async function seedTenant() {
  const tenantId = uid("t");
  const orgId    = uid("org");
  const userId   = uid("usr");

  await prisma.tenant.create({
    data: { id: tenantId, slug: tenantId, name: `E2E ${tenantId}`, status: "active" },
  });
  await prisma.org.create({
    data: { id: orgId, tenantId, type: "admin", name: "E2E Org" },
  });
  await prisma.user.create({
    data: { id: userId, email: `${userId}@e2e.test`, status: "active" },
  });
  return { tenantId, orgId, userId };
}

async function cleanupTenant(tenantId, userId) {
  await prisma.buildOpsPlanVersion.deleteMany({ where: { tenantId } });
  await prisma.buildOpsTask.deleteMany({ where: { tenantId } });
  await prisma.buildOpsProject.deleteMany({ where: { tenantId } });
  await prisma.projectIntake.deleteMany({ where: { tenantId } });
  await prisma.job.deleteMany({ where: { tenantId } });
  await prisma.org.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

// ── scenario runner ──────────────────────────────────────────────────────────

async function runScenario(scenario) {
  const { tenantId, orgId, userId } = await seedTenant();
  const sessionToken = uid("sess");
  const prefix = `[${scenario.id}]`;
  let intakeId = null;
  let jobId = null;

  console.log(`\n  ─── ${scenario.id} ───`);

  try {
    // 1. Analyze — create intake (pass tenantId so publish can access it)
    const analyze = await api("POST", "/v1/intake/analyze", {
      sessionToken,
      actorHeaders: { "x-tenant-id": tenantId },
      body: {
        sessionToken,
        rawDescription: scenario.description,
        category: scenario.selectedCategoryId,
        subcategory: scenario.selectedSubcategoryId ?? undefined,
      },
    });

    if (analyze.status !== 200 && analyze.status !== 201) {
      fail(`${prefix} analyze`, `Got ${analyze.status}: ${analyze.text.slice(0, 200)}`);
      return;
    }
    intakeId = analyze.json?.data?.intakeId;
    const detectedCategory = analyze.json?.data?.detectedCategory;
    if (detectedCategory !== scenario.expectedCategory) {
      fail(`${prefix} detectedCategory`, `Expected ${scenario.expectedCategory}, got ${detectedCategory}`);
    } else {
      pass(`${prefix} analyze → detectedCategory=${detectedCategory}`);
    }

    // 2. Answer questions to reach score >= threshold
    for (const answer of scenario.answers) {
      const res = await api("PATCH", `/v1/intake/${encodeURIComponent(intakeId)}/answer`, {
        sessionToken,
        actorHeaders: { "x-tenant-id": tenantId },
        body: {
          sessionToken,
          questionId: answer.questionId,
          selectedValues: answer.values,
          isNotSure: answer.notSure ?? false,
        },
      });
      if (res.status !== 200 && res.status !== 201) {
        fail(`${prefix} answer ${answer.questionId}`, `Got ${res.status}: ${res.text.slice(0, 150)}`);
        return;
      }
    }
    pass(`${prefix} ${scenario.answers.length} questions answered`);

    // 3. Check score after answers
    const intakeGet = await api("GET", `/v1/intake/${encodeURIComponent(intakeId)}`, { sessionToken, actorHeaders: { "x-tenant-id": tenantId } });
    const score = intakeGet.json?.data?.accuracyScore ?? intakeGet.json?.accuracyScore;
    if (typeof score !== "number" || score < scenario.expectedThreshold) {
      fail(`${prefix} score >= ${scenario.expectedThreshold}`, `Got ${score}`);
      return;
    }
    pass(`${prefix} score=${score} >= threshold=${scenario.expectedThreshold}`);

    // 4. Generate estimate
    const estimateRes = await api("POST", `/v1/intake/${encodeURIComponent(intakeId)}/estimate`, {
      sessionToken,
      actorHeaders: { "x-tenant-id": tenantId },
      body: { sessionToken },
    });
    if (estimateRes.status !== 200 && estimateRes.status !== 201) {
      fail(`${prefix} estimate`, `Got ${estimateRes.status}: ${estimateRes.text.slice(0, 200)}`);
      return;
    }
    const estimate = estimateRes.json?.data?.estimate;
    if (!estimate?.totalRange?.min) {
      fail(`${prefix} estimate has totalRange`, `Got data keys: ${Object.keys(estimateRes.json?.data ?? {}).join(", ")}`);
      return;
    }
    pass(`${prefix} estimate $${estimate.totalRange.min}–$${estimate.totalRange.max}`);

    // 5. Verify estimate range
    if (estimate.totalRange.min < scenario.minEstimate || estimate.totalRange.max > scenario.maxEstimate) {
      fail(`${prefix} estimate range $${scenario.minEstimate}–$${scenario.maxEstimate}`,
        `Got $${estimate.totalRange.min}–$${estimate.totalRange.max}`);
    } else {
      pass(`${prefix} estimate in expected range`);
    }

    // 6. Publish job
    const publishRes = await api("POST", `/v1/intake/${encodeURIComponent(intakeId)}/publish`, {
      sessionToken,
      actorHeaders: opsActor(tenantId, orgId, userId),
      body: {
        sessionToken,
        confirmEstimate: true,
        city: "Miami, FL",
        locationType: "on_site",
        urgency: "medium",
      },
    });
    if (publishRes.status !== 200 && publishRes.status !== 201) {
      fail(`${prefix} publish`, `Got ${publishRes.status}: ${publishRes.text.slice(0, 200)}`);
      return;
    }
    jobId = publishRes.json?.data?.jobId ?? publishRes.json?.jobId;
    if (!jobId) {
      fail(`${prefix} publish returns jobId`, `Response: ${publishRes.text.slice(0, 200)}`);
      return;
    }
    pass(`${prefix} job published → jobId=${jobId}`);

    // 7. Verify Job.category from DB
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      fail(`${prefix} job exists in DB`, `jobId=${jobId} not found`);
      return;
    }
    if (job.category !== scenario.expectedJobCategory) {
      fail(`${prefix} job.category="${scenario.expectedJobCategory}"`, `Got: "${job.category}"`);
    } else {
      pass(`${prefix} job.category="${job.category}"`);
    }

    // 8. Bridge to BuildOpsProject
    const bridgeRes = await api("POST", `/v1/jobs/${encodeURIComponent(jobId)}/operations/bridge`, {
      actorHeaders: opsActor(tenantId, orgId, userId),
      body: {},
    });
    if (bridgeRes.status !== 200 && bridgeRes.status !== 201) {
      fail(`${prefix} bridge`, `Got ${bridgeRes.status}: ${bridgeRes.text.slice(0, 200)}`);
      return;
    }
    pass(`${prefix} bridge → BuildOpsProject created`);

    // 9. Verify BuildOpsProject trade + projectType
    const bop = await prisma.buildOpsProject.findFirst({
      where: { tenantId, jobId },
      select: { id: true, trade: true, projectType: true, status: true, clientPlanApprovalStatus: true },
    });
    if (!bop) {
      fail(`${prefix} BuildOpsProject in DB`, "not found");
      return;
    }
    if (bop.trade !== scenario.expectedTrade) {
      fail(`${prefix} bop.trade="${scenario.expectedTrade}"`, `Got: "${bop.trade}"`);
    } else {
      pass(`${prefix} bop.trade="${bop.trade}"`);
    }
    if (bop.projectType !== scenario.expectedProjectType) {
      fail(`${prefix} bop.projectType="${scenario.expectedProjectType}"`, `Got: "${bop.projectType}"`);
    } else {
      pass(`${prefix} bop.projectType="${bop.projectType}"`);
    }
    if (bop.clientPlanApprovalStatus !== "pending") {
      fail(`${prefix} bop.clientPlanApprovalStatus=pending`, `Got: "${bop.clientPlanApprovalStatus}"`);
    } else {
      pass(`${prefix} bop.clientPlanApprovalStatus=pending (ready for client review)`);
    }

  } finally {
    await cleanupTenant(tenantId, userId);
  }
}

// ── scenarios ─────────────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    id: "bathroom_remodel",
    description: "Full bathroom remodel with new tile shower and plumbing",
    selectedCategoryId: "bano",
    expectedCategory: "bathroom_remodel",
    expectedThreshold: 45,
    answers: [
      { questionId: "bathroom_scope",     values: ["full_remodel"] },
      { questionId: "bathroom_size",      values: ["medium"] },
      { questionId: "bathroom_plumbing",  values: ["no_move"] },
    ],
    expectedJobCategory: "Remodelación de baño",
    expectedTrade: "remodeling",
    expectedProjectType: "bathroom-remodel",
    minEstimate: 2000,
    maxEstimate: 40000,
  },
  {
    id: "drywall_repair",
    description: "Fix drywall hole in bedroom wall, sheetrock patching needed",
    selectedCategoryId: "drywall",
    expectedCategory: "drywall_repair",
    expectedThreshold: 36,
    answers: [
      { questionId: "drywall_type", values: ["repair"] },
      { questionId: "drywall_area", values: ["10_100_sqft"] },
      { questionId: "drywall_condition", values: ["normal_wear"] },
    ],
    expectedJobCategory: "Reparación de drywall",
    expectedTrade: "drywall",
    expectedProjectType: "drywall-repair",
    minEstimate: 100,
    maxEstimate: 5000,
  },
  {
    id: "cleaning",
    description: "Deep cleaning of my apartment before moving out",
    selectedCategoryId: "limpieza",
    expectedCategory: "cleaning",
    expectedThreshold: 30,
    answers: [
      { questionId: "cleaning_type", values: ["move_inout"] },
      { questionId: "cleaning_size", values: ["1000_2000"] },
    ],
    expectedJobCategory: "Limpieza",
    expectedTrade: "cleaning",
    expectedProjectType: "residential-cleaning",
    minEstimate: 80,
    maxEstimate: 2000,
  },
];

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nSMOKE: intake → estimate → BuildOpsProject  →  ${BASE}\n`);

  const health = await fetch(`${BASE}/v1/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`API not reachable at ${BASE}`);
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  for (const scenario of SCENARIOS) {
    await runScenario(scenario);
  }

  await prisma.$disconnect();

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${passed}/${results.length} checks passed`);

  if (failed > 0) {
    console.log(`\nFailed:`);
    for (const r of results.filter(r => !r.ok)) {
      console.log(`  ❌  ${r.label}`);
      if (r.reason) console.log(`      ${r.reason}`);
    }
    console.log(`\nResult: FAIL`);
    process.exitCode = 1;
  } else {
    console.log(`\nResult: PASS`);
  }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
