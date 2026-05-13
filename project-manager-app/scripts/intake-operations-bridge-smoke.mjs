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

function jsonHeaders(extra = {}) {
  return {
    "content-type": "application/json",
    ...extra,
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

async function api(method, pathname, { headers, body } = {}) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return readJson(response);
}

function buildBearer(accessToken) {
  return {
    authorization: `Bearer ${accessToken}`,
  };
}

function buildActorHeaders() {
  return {
    "x-tenant-id": "tenant_default",
    "x-org-id": "org_client_001",
    "x-user-id": "usr_client_001",
    "x-roles": "CLIENT",
  };
}

function assertOk(result, label) {
  assert.ok(
    result.status === 200 || result.status === 201,
    `${label} failed: ${result.text}`,
  );
}

async function main() {
  const intakeSessionToken = `bridge_smoke_${Date.now()}`;
  const title = `Bridge Smoke ${Date.now()}`;
  const description = "Necesito pintar la sala principal y dejar las paredes con acabado limpio color blanco roto.";

  const analyze = await api("POST", "/v1/intake/analyze", {
    headers: jsonHeaders({
      "x-tenant-id": "tenant_default",
      "x-session-token": intakeSessionToken,
    }),
    body: {
      rawDescription: description,
      title,
      category: "pintura",
      subcategory: "interior",
      modality: "on_site",
      city: "Miami, FL",
      urgency: "medium",
    },
  });
  assertOk(analyze, "analyze");
  const intakeId = analyze.json?.data?.intakeId;
  assert.ok(intakeId, "missing intakeId");

  const answers = [
    { questionId: "painting_area", selectedValues: ["other"], customText: "240 sqft", isNotSure: false },
    { questionId: "painting_condition", selectedValues: ["good"], isNotSure: false },
    { questionId: "painting_coats", selectedValues: ["2"], isNotSure: false },
    { questionId: "painting_estimate_preference", selectedValues: ["both"], isNotSure: false },
    { questionId: "painting_pricing_mode", selectedValues: ["per_area"], isNotSure: false },
    { questionId: "painting_duration", selectedValues: ["3_5_days"], isNotSure: false },
  ];

  for (const answer of answers) {
    const result = await api("PATCH", `/v1/intake/${encodeURIComponent(intakeId)}/answer`, {
      headers: jsonHeaders({
        "x-session-token": intakeSessionToken,
      }),
      body: answer,
    });
    assert.ok(result.status === 200, `answer failed for ${answer.questionId}: ${result.text}`);
  }

  const estimate = await api("POST", `/v1/intake/${encodeURIComponent(intakeId)}/estimate`, {
    headers: {
      "x-session-token": intakeSessionToken,
    },
  });
  assertOk(estimate, "estimate");

  const claim = await api("POST", `/v1/intake/${encodeURIComponent(intakeId)}/claim`, {
    headers: jsonHeaders(buildActorHeaders()),
    body: {
      sessionToken: intakeSessionToken,
    },
  });
  assertOk(claim, "claim");

  const publish = await api("POST", `/v1/intake/${encodeURIComponent(intakeId)}/publish`, {
    headers: jsonHeaders(buildActorHeaders()),
    body: {
      confirmEstimate: true,
      title,
      category: "Pintura interior",
      locationType: "on_site",
      city: "Miami, FL",
      urgency: "medium",
    },
  });
  assertOk(publish, "publish");
  const jobId = publish.json?.data?.jobId;
  assert.ok(jobId, "publish did not return jobId");

  const firstBridge = await api("POST", `/v1/jobs/${encodeURIComponent(jobId)}/operations/bridge`, {
    headers: buildActorHeaders(),
  });
  assertOk(firstBridge, "first bridge");

  const secondBridge = await api("POST", `/v1/jobs/${encodeURIComponent(jobId)}/operations/bridge`, {
    headers: buildActorHeaders(),
  });
  assertOk(secondBridge, "second bridge");

  const firstData = firstBridge.json?.data;
  const secondData = secondBridge.json?.data;
  assert.ok(firstData?.buildOpsProjectId, "missing buildOpsProjectId");
  assert.equal(secondData?.buildOpsProjectId, firstData?.buildOpsProjectId, "bridge should reuse the same buildops project");
  assert.equal(secondData?.tasksCreated, 0, "second bridge should not create duplicate tasks");
  assert.equal(secondData?.idempotency?.reusedBuildOpsProject, true, "second bridge should reuse buildops project");

  const project = await prisma.buildOpsProject.findUnique({
    where: { jobId },
    include: {
      tasks: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  assert.ok(project, "BuildOpsProject not found in DB");
  assert.equal(project.tasks.length, 6, "expected 6 buildops tasks");

  const sourceToolResult = project.sourceToolResult && typeof project.sourceToolResult === "object" && !Array.isArray(project.sourceToolResult)
    ? project.sourceToolResult
    : null;
  const milestoneCount = Array.isArray(sourceToolResult?.milestonePlan?.milestones)
    ? sourceToolResult.milestonePlan.milestones.length
    : 0;
  const evidenceCount = Array.isArray(sourceToolResult?.evidenceChecklist?.items)
    ? sourceToolResult.evidenceChecklist.items.length
    : 0;

  assert.ok(milestoneCount > 0, "expected milestone plan in sourceToolResult");
  assert.ok(evidenceCount > 0, "expected evidence checklist in sourceToolResult");

  console.log(JSON.stringify({
    ok: true,
    apiBaseUrl,
    intakeId,
    jobId,
    buildOpsProjectId: firstData.buildOpsProjectId,
    firstBridge: {
      tasksCreated: firstData.tasksCreated,
      estimateStatus: firstData.estimate?.status,
      paymentStatus: firstData.paymentReadiness?.status,
    },
    secondBridge: {
      tasksCreated: secondData.tasksCreated,
      tasksReused: secondData.tasksReused,
      reusedBuildOpsProject: secondData.idempotency?.reusedBuildOpsProject,
      reusedTasks: secondData.idempotency?.reusedTasks,
    },
    db: {
      taskCount: project.tasks.length,
      milestoneCount,
      evidenceCount,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
