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
    roles: process.env.SEMSE_ROLES ?? "OPS_ADMIN,WORKER"
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
  await claimRun(config.workerId);
  await heartbeat(run.id);
  await completeRun(run.id);
  await assertRunCompleted(run.id);

  const staleRun = await createAgentRun();
  await claimRun(config.workerId);
  await sleep(15);
  await assertReclaimWorks(staleRun.id);

  await assertOpsDashboard();

  console.log("[api-integration] success");
}

async function createJob() {
  const { json } = await request(actors.client, "POST", "/v1/jobs", {
    title: `IT Job ${stamp}`,
    scope: "Integration flow scope with enough detail for validation.",
    budgetMin: 1000,
    budgetMax: 3000
  });
  assert.equal(json.data.status, "posted");
  return json.data;
}

async function createReservation(jobId) {
  const { json } = await request(actors.pro, "POST", `/v1/jobs/${jobId}/reservations`, {
    expiresInMinutes: 45
  });
  assert.equal(json.data.status, "active");
  return json.data;
}

async function acceptReservation(reservationId) {
  const { json } = await request(actors.client, "POST", `/v1/reservations/${reservationId}/accept`, {});
  assert.equal(json.data.status, "accepted");
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
  assert.equal(json.data.status, "draft");
  return json.data;
}

async function submitMilestone(milestoneId) {
  await request(actors.pro, "POST", "/v1/evidence", {
    milestoneId,
    key: `evidence/${stamp}-integration-photo.jpg`,
    kind: "PHOTO"
  });

  const { json } = await request(actors.pro, "POST", `/v1/milestones/${milestoneId}/submit`, {});
  assert.equal(json.data.status, "submitted");
}

async function approveMilestone(milestoneId) {
  const { json } = await request(actors.client, "POST", `/v1/milestones/${milestoneId}/approve`, {});
  assert.equal(json.data.status, "approved");
}

async function fundEscrow(jobId, contractId, amount) {
  const { json } = await request(actors.client, "POST", `/v1/jobs/${jobId}/escrow/fund`, {
    amount,
    currency: "USD"
  });
  assert.equal(json.data.transaction.type, "deposit");
  assert.equal(json.data.contract.id, contractId);
}

async function releaseMilestone(milestoneId) {
  const { json } = await request(actors.client, "POST", `/v1/milestones/${milestoneId}/escrow/release`, {});
  assert.equal(json.data.transaction.type, "release");
}

async function assertMilestonePaid(projectId, milestoneId) {
  const { json } = await request(actors.client, "GET", `/v1/projects/${projectId}/milestones`);
  const ms = json.data.find((entry) => entry.id === milestoneId);
  assert.ok(ms, "milestone should exist");
  assert.equal(ms.status, "paid");
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
  assert.equal(json.data.status, "open");
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
  assert.equal(json.data.status, "queued");
  return json.data;
}

async function claimRun(workerId) {
  const { json } = await request(actors.ops, "POST", "/v1/agents/runs/claim", { workerId });
  return json.data;
}

async function heartbeat(runId) {
  const { json } = await request(actors.ops, "POST", `/v1/agents/runs/${runId}/heartbeat`, {
    workerId: config.workerId
  });
  assert.equal(json.data.status, "running");
}

async function completeRun(runId) {
  const { json } = await request(actors.ops, "POST", `/v1/agents/runs/${runId}/complete`, {
    output: { status: "ok", source: "api-integration" }
  });
  assert.equal(json.data.status, "completed");
}

async function assertRunCompleted(runId) {
  const { json } = await request(actors.ops, "GET", `/v1/agents/runs/${runId}`);
  assert.equal(json.data.status, "completed");
}

async function assertReclaimWorks(runId) {
  const { json } = await request(actors.ops, "POST", "/v1/agents/runs/reclaim-stale", {
    staleAfterMs: 1,
    maxItems: 20
  });
  assert.ok(json.data.reclaimedCount >= 1, "at least one run should be reclaimed");
  const reclaimed = json.data.runs.find((entry) => entry.id === runId);
  assert.ok(reclaimed, "specific stale run should be reclaimed");
  assert.equal(reclaimed.status, "queued");
}

async function assertOpsDashboard() {
  const { json } = await request(actors.ops, "GET", "/v1/ops/dashboard");
  assert.ok(json.data.jobs.total >= 1);
  assert.ok(json.data.projects.total >= 1);
  assert.ok(json.data.disputes.total >= 1);
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

main().catch((error) => {
  console.error("[api-integration] failed", error);
  process.exit(1);
});
