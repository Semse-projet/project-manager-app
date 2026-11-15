/**
 * #1147 / PR #1149 regression: signed HTTP job.created => real BullMQ Worker.
 * Hard scope: disposable GitHub Actions PostgreSQL/Redis only.
 * Never execute against Railway, preview, staging or production.
 */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";

const tag = "qa-1149-agentrun-event";
const dbUrlText = process.env.DATABASE_URL ?? "";
const apiText = process.env.SEMSE_API_URL ?? "";
function refuse(reason) { throw new Error(tag + ": refused: " + reason); }
if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.GITHUB_REPOSITORY !== "Semse-projet/project-manager-app" ||
  process.env.SEMSE_QA_1149_DISPOSABLE !== "1" ||
  process.env.NODE_ENV !== "test" ||
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.RAILWAY_ENVIRONMENT_NAME
) refuse("not an explicitly opted-in disposable GitHub runner");
let dbUrl, apiUrl;
try { dbUrl = new URL(dbUrlText); apiUrl = new URL(apiText); }
catch { refuse("missing or invalid URL"); }
if (
  dbUrl.hostname !== "127.0.0.1" || dbUrl.port !== "5433" ||
  dbUrl.pathname !== "/semse" || dbUrl.username !== "semse" ||
  apiUrl.hostname !== "127.0.0.1" || apiUrl.port !== "4000" ||
  apiUrl.protocol !== "http:" || apiUrl.pathname !== "/"
) refuse("nonlocal or unexpected database/API target");
if (!process.env.AUTH_SECRET || !process.env.SEMSE_BOOTSTRAP_TOKEN) {
  refuse("missing ephemeral authentication secrets");
}
const prisma = new PrismaClient();
const sample = "SEMSE QA-1149 " + randomUUID();
const pollTimeoutMs = 90_000;
const emit = (phase, data = {}) => console.log(JSON.stringify({tag, phase, ...data}));

async function post(path, body, token) {
  const response = await fetch(apiText + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? {authorization: "Bearer " + token} : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const value = await response.json().catch(() => null);
  // Never log entire responses: they may contain access and refresh tokens.
  assert.equal(response.status, 201, path + " HTTP " + response.status);
  assert.ok(value && typeof value.requestId === "string" && value.data, path + " canonical envelope failed");
  return value.data;
}
try {
  const [tenant, workerMembership, duplicates] = await Promise.all([
    prisma.tenant.findFirst({where: {id: "tenant_default", status: "active"}, select: {id: true}}),
    prisma.membership.findFirst({
      where: {
        userId: "usr_worker_system", orgId: "org_admin_001", status: "ACTIVE",
        role: {key: "AGENT_RUNNER"},
      },
      select: {userId: true},
    }),
    prisma.job.count({where: {title: sample}}),
  ]);
  assert.ok(tenant, "isolated tenant fixture missing");
  assert.ok(workerMembership, "worker has no active AGENT_RUNNER membership");
  assert.equal(duplicates, 0);

  const health = await fetch(apiText + "/v1/health", {signal: AbortSignal.timeout(10_000)});
  assert.equal(health.status, 200, "signed local API not healthy");
  const email = "qa1149-" + randomUUID() + "@example.com";
  const password = "QATest-1149-" + randomUUID() + "-!";
  const actor = await post("/v1/auth/register", {
    email, password, name: "Synthetic CI client", role: "CLIENT",
  });
  assert.ok(actor?.accessToken, "registration returned no access token");
  emit("signed_client_created", {tenant: "tenant_default"});

  const job = await post("/v1/jobs", {
    title: sample,
    scope: "Synthetic disposable CI validation of event-triggered pricing and risk; no contract, customer, payment or physical work.",
    category: "general", locationType: "remote", urgency: "low",
  }, actor.accessToken);
  assert.ok(job?.id, "job create returned no ID");
  const correlationId = "job:" + job.id + ":created";
  emit("synthetic_job_created", {correlationId});

  const pollStart = Date.now();
  let runs = [];
  while (Date.now() - pollStart < pollTimeoutMs) {
    runs = await prisma.agentRun.findMany({
      where: {tenantId: "tenant_default", correlationId, agentType: {in: ["pricing", "risk"]}},
      orderBy: {createdAt: "asc"},
      select: {
        id: true, agentType: true, triggerType: true, status: true,
        attempts: true, workerId: true, startedAt: true, endedAt: true, inputJson: true, error: true,
      },
    });
    if (runs.length === 2 && runs.every(r => r.status === "COMPLETED" || r.status === "FAILED")) break;
    await delay(1_500);
  }
  emit("observed", {
    count: runs.length,
    runs: runs.map(r => ({
      agentType: r.agentType, status: r.status,
      attempts: r.attempts, workerClaimed: Boolean(r.workerId),
      errorCategory: !r.error ? null : /403|forbidden|insufficient permissions/i.test(r.error) ? "forbidden_403" : /401|unauthorized/i.test(r.error) ? "unauthorized_401" : /context|projectId|jobId/i.test(r.error) ? "context_error" : /claimToken|fenc/i.test(r.error) ? "fencing_error" : "other",
      errorFingerprint: r.error ? createHash("sha256").update(r.error).digest("hex").slice(0,12) : null,
      failedRequestSurface: !r.error ? null : /\/v1\/jobs\//i.test(r.error) ? "jobs_detail" : /\/v1\/agents\/runs\/[^\s]+\/complete/i.test(r.error) ? "run_complete" : /\/v1\/agents\/runs\/[^\s]+\/start/i.test(r.error) ? "run_start" : /\/v1\/agents\/runs\/[^\s]+\/fail/i.test(r.error) ? "run_fail" : /\/v1\/projects\//i.test(r.error) ? "projects_detail" : "unclassified_surface",
      failureDetail: r.error ? r.error.replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]").replace(/cm[a-z0-9]{15,}/gi, "[synthetic_id]").replace(/[A-Za-z0-9_-]{40,}/g, "[REDACTED]").slice(0,240) : null,
    })),
  });
  assert.equal(runs.length, 2, "expected one pricing and one risk run");
  assert.deepEqual(runs.map(r => r.agentType).sort(), ["pricing", "risk"]);
  for (const r of runs) {
    assert.equal(r.triggerType, "event");
    assert.equal(r.inputJson?.eventType, "job.created");
    assert.equal(r.inputJson?.eventPayload?.jobId, job.id);
    assert.equal(r.status, "COMPLETED", r.agentType + " did not complete");
    assert.ok(r.workerId, r.agentType + " lacks worker claim");
    assert.ok(r.startedAt && r.endedAt, r.agentType + " lifecycle not persisted");
  }

  // Negative HTTP authorization tests: no token or credentials are emitted.
  const serviceSessionResponse = await fetch(apiText + "/v1/auth/token", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-semse-bootstrap-token": process.env.SEMSE_BOOTSTRAP_TOKEN,
    },
    body: JSON.stringify({
      userId: "usr_worker_system", tenantId: "tenant_default",
      orgId: "org_admin_001", roles: ["AGENT_RUNNER"], ttlSeconds: 120,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(serviceSessionResponse.status, 201, "ephemeral service token not issued");
  const serviceSession = await serviceSessionResponse.json();
  const workerBearer = serviceSession?.data?.accessToken;
  assert.ok(workerBearer, "ephemeral service token missing");
  const { signAgentRunClaimToken } = await import(
    "../apps/api/dist/modules/agents/agent-run-claim-token.js"
  );
  const sampleRun = runs[0];
  const binding = {
    tenantId: "tenant_default", orgId: "org_admin_001",
    userId: "usr_worker_system", runId: sampleRun.id,
    workerId: sampleRun.workerId, attempts: sampleRun.attempts,
  };
  async function contextStatus(bearer, claimToken, b = binding) {
    const response = await fetch(
      apiText + "/v1/agents/runs/" + encodeURIComponent(sampleRun.id) + "/job-created-context",
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + bearer },
        body: JSON.stringify({
          workerId: b.workerId, expectedAttempts: b.attempts, claimToken,
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );
    return response.status;
  }
  const validTerminalToken = signAgentRunClaimToken(binding);
  const badHmac = await contextStatus(workerBearer, "invalid-token");
  assert.equal(badHmac, 403, "bad HMAC must not read Job context");
  const clientDenied = await contextStatus(actor.accessToken, validTerminalToken);
  assert.equal(clientDenied, 403, "CLIENT may not consume Worker context");
  const terminalDenied = await contextStatus(workerBearer, validTerminalToken);
  assert.equal(terminalDenied, 404, "completed run must not read context again");
  const staleAttempt = { ...binding, attempts: binding.attempts + 1 };
  const staleDenied = await contextStatus(
    workerBearer, signAgentRunClaimToken(staleAttempt), staleAttempt
  );
  assert.equal(staleDenied, 404, "an inactive worker generation must not read context");
  emit("negative_http_PASS", {
    invalidClaim: badHmac, clientWithoutRunner: clientDenied,
    terminalAttempt: terminalDenied, staleGeneration: staleDenied,
  });

  emit("PASS", {correlationId, agentTypes: ["pricing", "risk"]});
} finally {
  await prisma.$disconnect();
}
