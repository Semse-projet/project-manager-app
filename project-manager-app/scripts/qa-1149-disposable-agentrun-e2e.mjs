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

  // Codex P1: tenant-wide AgentRun result reads must not leak current private
  // Job scope, budget, estimates or error summaries to a different CLIENT org.
  const secondClient = await post("/v1/auth/register", {
    email: "qa1149-other-" + randomUUID() + "@example.com",
    password: "QATest-1149-" + randomUUID() + "-!",
    name: "Synthetic unrelated CI client",
    role: "CLIENT",
  });
  assert.ok(secondClient?.accessToken, "second synthetic client token missing");
  async function readEndpoint(path, bearer) {
    const response = await fetch(apiText + path, {
      headers: { authorization: "Bearer " + bearer },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json().catch(() => null);
    assert.equal(response.status, 200, path + " returned " + response.status);
    return body?.data;
  }
  const foreignJobResponse = await fetch(apiText + "/v1/jobs/" + encodeURIComponent(job.id), {
    headers: { authorization: "Bearer " + secondClient.accessToken },
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(foreignJobResponse.status, 403, "other CLIENT must not see originating Job");
  const foreignRunList = await readEndpoint("/v1/agents/runs", secondClient.accessToken);
  assert.ok(Array.isArray(foreignRunList), "foreign run list response invalid");
  for (const completed of runs) {
    const runPath = "/v1/agents/runs/" + encodeURIComponent(completed.id);
    const ownerDetail = await readEndpoint(runPath, actor.accessToken);
    assert.ok(ownerDetail?.output, "owning client should see completed run output");
    const foreignDetail = await readEndpoint(runPath, secondClient.accessToken);
    assert.equal(foreignDetail?.output ?? null, null,
      "different CLIENT org must not see enriched AgentRun output");
    // Cancel normally returns a full AgentRun, so it must not be an output
    // disclosure backdoor for a different org's completed run.
    const forbiddenCancel = await fetch(apiText + runPath + "/cancel", {
      method: "POST",
      headers: { authorization: "Bearer " + secondClient.accessToken },
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(forbiddenCancel.status, 404,
      "foreign-org cancel must not disclose or mutate the scoped AgentRun");
    assert.equal(foreignDetail?.error ?? null, null,
      "different CLIENT org must not see sensitive error details");
    const listItem = foreignRunList.find(r => r.id === completed.id);
    assert.ok(listItem, "cross-org run metadata should retain prior behavior");
    assert.equal(listItem.output ?? null, null, "run list leaked enriched output");
    const foreignEvents = await readEndpoint(runPath + "/events", secondClient.accessToken);
    assert.ok(Array.isArray(foreignEvents?.events), "event view missing");
    const terminal = foreignEvents.events.find(x => x.type === "completed");
    assert.equal(terminal?.detail, "Run completed successfully",
      "event outputSummary leaked across organizations");
    assert.equal(foreignEvents.events.some(x => x.type === "input"), false,
      "event input summary leaked across organizations");
  }
  emit("cross_org_output_privacy_PASS", {checkedRuns: runs.length, foreignJobStatus: foreignJobResponse.status});

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
  async function contextStatus(bearer, claimToken, b = binding, runId = sampleRun.id) {
    const response = await fetch(
      apiText + "/v1/agents/runs/" + encodeURIComponent(runId) + "/job-created-context",
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
  // Real event-created runs have already completed; terminal rejection alone
  // cannot prove that fencing works while a lease is RUNNING.
  const originalRunToken = signAgentRunClaimToken(binding);
  const completedDenied = await contextStatus(workerBearer, originalRunToken);
  assert.equal(completedDenied, 404, "completed run must not read context again");

  // This direct DB fixture is ONLY an adversarial control on disposable
  // GitHub runner PostgreSQL. It is never queued or used as a business run.
  const ownedJob = await prisma.job.findFirst({
    where: { id: job.id, tenantId: "tenant_default" },
    select: { clientOrgId: true },
  });
  assert.ok(ownedJob?.clientOrgId, "origin organization missing from synthetic Job");
  const securityRun = await prisma.agentRun.create({
    data: {
      tenantId: "tenant_default",
      agentType: "pricing",
      triggerType: "event",
      correlationId,
      inputJson: {
        eventType: "job.created",
        eventPayload: { jobId: job.id, clientOrgId: ownedJob.clientOrgId },
        operatorContext: { tenantId: "tenant_default", orgId: ownedJob.clientOrgId },
      },
      status: "RUNNING",
      workerId: "gha-qa1149-security-fixture",
      attempts: 2,
      maxAttempts: 3,
      deadLettered: false,
      startedAt: new Date(),
      heartbeatAt: new Date(),
    },
  });
  try {
    const active = {
      ...binding,
      runId: securityRun.id,
      workerId: "gha-qa1149-security-fixture",
      attempts: 2,
    };
    const validLive = await contextStatus(
      workerBearer, signAgentRunClaimToken(active), active, securityRun.id
    );
    assert.equal(validLive, 201, "current active claimant should obtain minimal Job context");
    const signedToken = signAgentRunClaimToken(active);
    // Same valid base64url token length, but different decoded MAC bytes.
    const tamperedHmac = (signedToken[0] === "A" ? "B" : "A") + signedToken.slice(1);
    assert.match(tamperedHmac, /^[A-Za-z0-9_-]{43}$/);
    const invalidHmac = await contextStatus(
      workerBearer, tamperedHmac, active, securityRun.id
    );
    assert.equal(invalidHmac, 403, "invalid HMAC must be rejected for active run");
    const clientDenied = await contextStatus(
      actor.accessToken, signAgentRunClaimToken(active), active, securityRun.id
    );
    assert.equal(clientDenied, 403, "CLIENT may not use context even with claim");
    const otherGeneration = { ...active, attempts: 3 };
    const staleAttemptDenied = await contextStatus(
      workerBearer, signAgentRunClaimToken(otherGeneration),
      otherGeneration, securityRun.id
    );
    assert.equal(staleAttemptDenied, 404, "different attempt must fail while run is RUNNING");
    const otherWorker = { ...active, workerId: "unrelated-worker" };
    const otherWorkerDenied = await contextStatus(
      workerBearer, signAgentRunClaimToken(otherWorker),
      otherWorker, securityRun.id
    );
    assert.equal(otherWorkerDenied, 404, "different worker must fail while run is RUNNING");
    emit("negative_http_PASS", {
      activeFencedClaim: validLive,
      invalidClaim: invalidHmac,
      clientWithoutRunner: clientDenied,
      terminalAttempt: completedDenied,
      staleGenerationWhileRunning: staleAttemptDenied,
      wrongWorkerWhileRunning: otherWorkerDenied,
    });
  } finally {
    // Remove only the artificial security fixture; preserve the two real runs
    // as the immutable E2E result until the disposable runner is destroyed.
    await prisma.agentRun.delete({ where: { id: securityRun.id } });
  }

  emit("PASS", {correlationId, agentTypes: ["pricing", "risk"]});
} finally {
  await prisma.$disconnect();
}
