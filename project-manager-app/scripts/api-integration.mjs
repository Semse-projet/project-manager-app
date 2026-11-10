import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://localhost:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? "tnt_demo",
  workerId: process.env.SEMSE_WORKER_ID ?? "worker-it-001"
};

const actors = {
  client: {
    userId: "usr_it_client",
    orgId: "org_it_client",
    roles: "CLIENT"
  },
  pro: {
    userId: "usr_it_pro",
    orgId: "org_it_pro",
    roles: "PRO"
  },
  ops: {
    userId: process.env.SEMSE_USER_ID ?? "usr_it_ops",
    orgId: process.env.SEMSE_ORG_ID ?? "org_it_ops",
    roles: process.env.SEMSE_ROLES ?? "OPS_ADMIN,WORKER,AGENT_RUNNER"
  }
};

const stamp = Date.now();

async function main() {
  console.log("[api-integration] starting", config.apiBaseUrl);

  const job = await createJob();
  const reservation = await createReservation(job.id);
  await acceptReservation(reservation.id);
  const contract = await createContract(job.id);
  await signContract(contract.id);

  const project = await findProjectByJob(job.id);
  assert.ok(project, "project should be auto-created after reservation acceptance");

  const milestone = await createMilestone(project.id);
  await submitMilestone(milestone.id);
  await approveMilestone(milestone.id);

  await fundEscrow(job.id, contract.id, 5000);
  await releaseMilestone(milestone.id);
  await assertMilestonePaid(project.id, milestone.id);
  await assertEscrowSummary(job.id, contract.id, 5000, 1200);

  await createDispute(project.id);
  await assertDuplicateDisputeRejected(project.id);

  const run = await createAgentRun();
  await assertUnprivilegedClaimDenied(run.id);
  const claimedRun = await claimSpecificRun(run.id, config.workerId);
  await heartbeat(claimedRun);
  await assertStaleCompletionRejected(claimedRun);
  await assertUnfencedWorkerMutationDenied(claimedRun);
  await completeRun(claimedRun);
  await assertRunCompleted(run.id);

  const staleRun = await createAgentRun();
  await claimSpecificRun(staleRun.id, config.workerId);
  await sleep(15);
  await assertReclaimWorks(staleRun.id);

  await assertOpsDashboard();
  await assertMaterialPricingProvenance();
  await assertProToolsPricingDisclosure();

  console.log("[api-integration] success");
}

async function createJob() {
  const { json } = await request(actors.client, "POST", "/v1/jobs", {
    title: `IT Job ${stamp}`,
    scope: "Integration flow scope with enough detail for validation.",
    budgetMin: 1000,
    budgetMax: 3000
  });
  assertCanonicalValue(json.data.status, "posted");
  return json.data;
}

async function createReservation(jobId) {
  const { json } = await request(actors.pro, "POST", `/v1/jobs/${jobId}/reservations`, {
    expiresInMinutes: 45
  });
  assertCanonicalValue(json.data.status, "active");
  return json.data;
}

async function acceptReservation(reservationId) {
  const { json } = await request(actors.client, "POST", `/v1/reservations/${reservationId}/accept`, {});
  assertCanonicalValue(json.data.status, "accepted");
}

async function createContract(jobId) {
  const { json } = await request(actors.client, "POST", `/v1/jobs/${jobId}/contracts`, {
    termsJson: {
      currency: "USD",
      releasePolicy: "approved_milestone_only"
    }
  });
  assert.equal(json.data.jobId, jobId);
  return json.data;
}

async function signContract(contractId) {
  const clientSigned = await request(actors.client, "POST", `/v1/contracts/${contractId}/sign`, {
    documentHash: "1234567890abcdef-integration",
    pdfUrl: "https://example.com/contracts/integration.pdf"
  });
  assert.ok(clientSigned.json.data.signedClientAt);

  const proSigned = await request(actors.pro, "POST", `/v1/contracts/${contractId}/sign`, {
    documentHash: "1234567890abcdef-integration"
  });
  assert.ok(proSigned.json.data.signedProAt);
}

async function findProjectByJob(jobId) {
  const { json } = await request(actors.ops, "GET", `/v1/projects?jobId=${encodeURIComponent(jobId)}`);
  assert.ok(Array.isArray(json.data));
  return json.data.find((entry) => entry.jobId === jobId);
}

async function createMilestone(projectId) {
  const { json } = await request(actors.ops, "POST", `/v1/projects/${projectId}/milestones`, {
    title: "Milestone Integration",
    amount: 1200,
    sequence: 1
  });
  assertCanonicalValue(json.data.status, "draft");
  return json.data;
}

async function submitMilestone(milestoneId) {
  await request(actors.pro, "POST", "/v1/evidence", {
    milestoneId,
    key: `evidence/${stamp}-integration-photo.jpg`,
    kind: "PHOTO"
  });

  const { json } = await request(actors.pro, "POST", `/v1/milestones/${milestoneId}/submit`, {});
  assertCanonicalValue(json.data.status, "submitted");
}

async function approveMilestone(milestoneId) {
  const { json } = await request(actors.client, "POST", `/v1/milestones/${milestoneId}/approve`, {});
  assertCanonicalValue(json.data.status, "approved");
}

async function fundEscrow(jobId, contractId, amount) {
  const { json } = await request(actors.client, "POST", `/v1/jobs/${jobId}/escrow/fund`, {
    amount,
    currency: "USD"
  });
  assertCanonicalValue(json.data.transaction.type, "fund");
  assert.equal(json.data.contract.id, contractId);
}

async function releaseMilestone(milestoneId) {
  const { json } = await request(actors.client, "POST", `/v1/milestones/${milestoneId}/escrow/release`, {});
  assertCanonicalValue(json.data.transaction.type, "release");
}

async function assertMilestonePaid(projectId, milestoneId) {
  const { json } = await request(actors.client, "GET", `/v1/projects/${projectId}/milestones`);
  const ms = json.data.find((entry) => entry.id === milestoneId);
  assert.ok(ms, "milestone should exist");
  assertCanonicalValue(ms.status, "paid");
}

async function assertEscrowSummary(jobId, contractId, totalDeposited, totalReleased) {
  const { json } = await request(actors.client, "GET", `/v1/jobs/${jobId}/escrow`);
  assert.equal(json.data.contract.id, contractId);
  assert.equal(json.data.totalDeposited, totalDeposited);
  assert.equal(json.data.totalReleased, totalReleased);
  assert.equal(json.data.available, totalDeposited - totalReleased);
}

async function createDispute(projectId) {
  const { json } = await request(actors.client, "POST", "/v1/disputes", {
    projectId,
    reason: "Integration dispute reason"
  });
  assertCanonicalValue(json.data.status, "open");
}

async function assertDuplicateDisputeRejected(projectId) {
  const { status } = await request(
    actors.client,
    "POST",
    "/v1/disputes",
    { projectId, reason: "Duplicate dispute should fail" },
    { expectedStatus: 409 }
  );
  assert.equal(status, 409);
}

async function createAgentRun() {
  const { json } = await request(actors.ops, "POST", "/v1/agents/runs", {
    agentType: "risk",
    triggerType: "manual",
    correlationId: `corr-${Date.now()}-${Math.random().toString(16).slice(2)}`
  });
  assertCanonicalValue(json.data.status, "queued");
  return json.data;
}

async function claimRun(workerId, runId) {
  const { json } = await request(actors.ops, "POST", "/v1/agents/runs/claim", { workerId, runId });
  return json.data;
}

async function claimSpecificRun(runId, workerId) {
  // Never claim/complete unrelated queued runs as test cleanup.
  for (let attempt = 0; attempt < 10; attempt++) {
    const claimed = await claimRun(workerId, runId);
    if (claimed) {
      assert.equal(claimed.id, runId, "targeted claim must not take another queued run");
      assertCanonicalValue(claimed.status, "running");
      return claimed;
    }
    await sleep(50);
  }
  assert.fail(`expected to claim run ${runId}`);
}

async function assertUnprivilegedClaimDenied(runId) {
  for (const roles of ["WORKER", "OPS_ADMIN,WORKER"]) {
    const actor = { ...actors.ops, roles };
    const denied = await request(actor, "POST", "/v1/agents/runs/claim",
      { workerId: config.workerId, runId }, { expectedStatus: 403 });
    assert.equal(denied.status, 403, "human role must not mint a worker claim capability");
  }
}

// An owned AgentRun can only be mutated by the exact worker generation
// returned from claimNext; the smoke must exercise that HTTP contract.
function assertFencedClaim(run) {
  assert.equal(run.workerId, config.workerId, "smoke claimed unexpected worker owner");
  assert.ok(Number.isInteger(run.attempts) && run.attempts > 0,
    "claimed AgentRun must expose a positive attempt generation");
  assert.match(run.claimToken ?? "", /^[A-Za-z0-9_-]{43}$/, "claim must return a private signed token");
}

async function heartbeat(run) {
  assertFencedClaim(run);
  const { json } = await request(actors.ops, "POST", `/v1/agents/runs/${run.id}/heartbeat`, {
    workerId: run.workerId, expectedAttempts: run.attempts, claimToken: run.claimToken
  });
  assertCanonicalValue(json.data.status, "running");
}

async function assertStaleCompletionRejected(run) {
  assertFencedClaim(run);
  const { status } = await request(actors.ops, "POST", `/v1/agents/runs/${run.id}/complete`, {
    workerId: run.workerId,
    expectedAttempts: run.attempts - 1,
    claimToken: run.claimToken,
    output: { summary: "obsolete worker result must not be committed" }
  }, { expectedStatus: 403 });
  assert.equal(status, 403, "wrong generation must invalidate the signed claim token");

  const { json } = await request(actors.ops, "GET", `/v1/agents/runs/${run.id}`);
  assertCanonicalValue(json.data.status, "running");
}

async function assertUnfencedWorkerMutationDenied(run) {
  assertFencedClaim(run);
  const workerActor = { ...actors.ops, roles: "WORKER" };
  for (const [operation, body] of [
    ["start", {}],
    ["complete", { output: { summary: "unfenced worker bypass" } }],
    ["fail", { error: "unfenced worker bypass" }]
  ]) {
    const { status, json } = await request(
      workerActor, "POST", `/v1/agents/runs/${run.id}/${operation}`,
      body, { expectedStatus: 403 }
    );
    assert.equal(status, 403);
    assert.match(JSON.stringify(json), /unfenced agent operations require an administrator/,
      "403 must come from the fencing role gate, not an unrelated permission check");
  }
  const differentWorker = { ...actors.ops, userId: "usr_it_different_worker", roles: "WORKER" };
  const denied = await request(differentWorker, "POST", `/v1/agents/runs/${run.id}/complete`, {
    workerId: run.workerId, expectedAttempts: run.attempts,
    claimToken: run.claimToken, output: { summary: "cross-principal spoof" },
  }, { expectedStatus: 403 });
  assert.equal(denied.status, 403, "claim capability must bind to authenticated principal");
  const { json } = await request(actors.ops, "GET", `/v1/agents/runs/${run.id}`);
  assertCanonicalValue(json.data.status, "running");
}

async function completeRun(run) {
  assertFencedClaim(run);
  const { json } = await request(actors.ops, "POST", `/v1/agents/runs/${run.id}/complete`, {
    workerId: run.workerId, expectedAttempts: run.attempts, claimToken: run.claimToken,
    output: { status: "ok", source: "api-integration" }
  });
  assertCanonicalValue(json.data.status, "completed");
}

async function assertRunCompleted(runId) {
  const { json } = await request(actors.ops, "GET", `/v1/agents/runs/${runId}`);
  assertCanonicalValue(json.data.status, "completed");
}

async function assertReclaimWorks(runId) {
  const { json } = await request(actors.ops, "POST", "/v1/agents/runs/reclaim-stale", {
    staleAfterMs: 1,
    maxItems: 20
  });
  assert.ok(json.data.reclaimedCount >= 1, "at least one run should be reclaimed");
  const reclaimed = json.data.runs.find((entry) => entry.id === runId);
  assert.ok(reclaimed, "specific stale run should be reclaimed");
  assertCanonicalValue(reclaimed.status, "queued");
}

async function assertOpsDashboard() {
  const { json } = await request(actors.ops, "GET", "/v1/ops/dashboard");
  assert.ok(json.data.jobs.total >= 1);
  assert.ok(json.data.projects.total >= 1);
  assert.ok(json.data.disputes.total >= 1);
}

async function assertMaterialPricingProvenance() {
  const { json } = await request(actors.ops, "GET", "/v1/pricing/materials");
  assert.ok(json.data && typeof json.data.prices === "object");
  assert.ok(
    ["LEGACY_CACHE_UNVERIFIED", "HARDCODED_FALLBACK_UNVERIFIED"].includes(json.data.source),
    "BLS PPI index must not be advertised as a certified USD unit price",
  );
  assert.ok(json.data.provenance && typeof json.data.provenance === "object");
  for (const value of Object.values(json.data.provenance)) {
    assert.equal(value.verification, "UNVERIFIED");
  }
}

async function assertProToolsPricingDisclosure() {
  const { json } = await request(actors.ops, "POST", "/v1/agents/semse/protools/estimate", {
    trade: "drywall",
    description: "Synthetic integration check; not a customer quote",
    area: 100,
    rooms: 1,
    locale: "en",
  });
  assert.equal(json.data.pricingEvidence?.status, "UNVERIFIED");
  assert.equal(json.data.pricingEvidence?.verificationBasis, "NO_COMMERCIAL_PRICE_VALIDATION");
  assert.equal(json.data.confidenceBasis, "HEURISTIC_NOT_CALIBRATED");
  assert.ok(
    json.data.riskFlags?.some(flag => /not commercially verified/i.test(flag)),
    "ProTools must visibly warn that unit prices are not commercially verified",
  );
  assert.match(json.data.agentNote, /tax treatment are preliminary and unverified/i);
  assert.ok(Number.isFinite(json.data.totalCost));
}

async function request(actor, method, path, body, options = {}) {
  const expectedStatus = options.expectedStatus ?? null;
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": config.tenantId,
      "x-user-id": actor.userId,
      "x-org-id": actor.orgId,
      "x-roles": actor.roles
    },
    body: body === undefined || method === "GET" ? undefined : JSON.stringify(body)
  });

  const json = await response.json();
  if (expectedStatus !== null) {
    assert.equal(response.status, expectedStatus, `unexpected status for ${method} ${path}`);
    return { status: response.status, json };
  }

  assert.ok(response.ok, `request failed ${method} ${path}: ${response.status} ${JSON.stringify(json)}`);
  return { status: response.status, json };
}

function assertCanonicalValue(actual, expected) {
  assert.equal(String(actual).toLowerCase(), String(expected).toLowerCase());
}

main().catch((error) => {
  console.error("[api-integration] failed", error);
  process.exit(1);
});
