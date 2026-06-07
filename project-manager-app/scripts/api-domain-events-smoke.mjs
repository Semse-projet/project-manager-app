import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? `tnt_domain_events_${Date.now()}`,
  expectCompleted: process.env.SEMSE_EXPECT_COMPLETED === "true",
  pollMs: Number(process.env.SEMSE_POLL_MS ?? 250),
  timeoutMs: Number(process.env.SEMSE_TIMEOUT_MS ?? 20000)
};

const actors = {
  client: {
    userId: "usr_domain_client",
    orgId: "org_domain_client",
    roles: "CLIENT"
  },
  pro: {
    userId: "usr_domain_pro",
    orgId: "org_domain_pro",
    roles: "PRO"
  },
  ops: {
    userId: process.env.SEMSE_USER_ID ?? "usr_domain_ops",
    orgId: process.env.SEMSE_ORG_ID ?? "org_ops",
    roles: process.env.SEMSE_ROLES ?? "OPS_ADMIN"
  }
};

async function main() {
  console.log("[smoke:domain-events] starting", {
    apiBaseUrl: config.apiBaseUrl,
    tenantId: config.tenantId,
    expectCompleted: config.expectCompleted
  });

  const health = await request(actors.ops, "GET", "/v1/health");
  assert.equal(health.data.persistence, "prisma");

  const job = await request(actors.client, "POST", "/v1/jobs", {
    title: `Domain Event Job ${Date.now()}`,
    scope: "Smoke test flow for domain-event routing to agent runs.",
    budgetMin: 900,
    budgetMax: 1800
  });
  const jobCorrelationId = `job:${job.data.id}:created`;
  const jobRuns = await waitForRuns(jobCorrelationId, ["pricing", "risk"]);

  const bid = await request(actors.pro, "POST", `/v1/jobs/${job.data.id}/bids`, {
    amount: 1150,
    etaDays: 10,
    proOrgId: actors.pro.orgId
  });
  await request(actors.client, "POST", `/v1/bids/${bid.data.id}/accept`, {});

  const projects = await request(actors.ops, "GET", `/v1/projects?jobId=${encodeURIComponent(job.data.id)}`);
  const project = projects.data.find((entry) => entry.jobId === job.data.id);
  assert.ok(project, "project should exist after accepted reservation");

  const milestone = await request(actors.ops, "POST", `/v1/projects/${project.id}/milestones`, {
    title: "Hito con trigger agentic",
    amount: 600,
    sequence: 1
  });
  await request(actors.pro, "POST", "/v1/evidence", {
    projectId: project.id,
    milestoneId: milestone.data.id,
    key: `evidence/${Date.now()}-domain-events.jpg`,
    kind: "PHOTO"
  });
  await request(actors.pro, "POST", `/v1/milestones/${milestone.data.id}/submit`, {});
  const milestoneCorrelationId = `milestone:${milestone.data.id}:submitted`;
  const milestoneRuns = await waitForRuns(milestoneCorrelationId, ["evidence-coach"]);

  const dispute = await request(actors.ops, "POST", "/v1/disputes", {
    projectId: project.id,
    reason: "Smoke test de disputa para validar trigger dispute.opened."
  });
  const disputeCorrelationId = `dispute:${dispute.data.id}:opened`;
  const disputeRuns = await waitForRuns(disputeCorrelationId, ["dispute", "risk"]);

  const audit = await request(actors.ops, "GET", "/v1/ops/audit");
  assert.ok(
    audit.data.some((entry) => entry.action === "domain.event.emit" && entry.entityId === `job.created:${jobCorrelationId}`)
  );
  assert.ok(
    audit.data.some(
      (entry) => entry.action === "domain.event.emit" && entry.entityId === `milestone.submitted:${milestoneCorrelationId}`
    )
  );
  assert.ok(
    audit.data.some(
      (entry) => entry.action === "domain.event.emit" && entry.entityId === `dispute.opened:${disputeCorrelationId}`
    )
  );

  console.log("[smoke:domain-events] success", {
    tenantId: config.tenantId,
    jobId: job.data.id,
    projectId: project.id,
    milestoneId: milestone.data.id,
    disputeId: dispute.data.id,
    expectedStatus: config.expectCompleted ? "completed" : "queued",
    jobRuns: summarizeRuns(jobRuns),
    milestoneRuns: summarizeRuns(milestoneRuns),
    disputeRuns: summarizeRuns(disputeRuns)
  });
}

async function waitForRuns(correlationId, expectedAgentTypes) {
  const deadline = Date.now() + config.timeoutMs;
  const expectedStatus = config.expectCompleted ? "completed" : "queued";

  while (Date.now() < deadline) {
    const listed = await request(actors.ops, "GET", "/v1/agents/runs");
    const runs = listed.data.filter((entry) => entry.correlationId === correlationId);
    const agentTypes = new Set(runs.map((entry) => entry.agentType));

    const hasAllAgents = expectedAgentTypes.every((agentType) => agentTypes.has(agentType));
    const hasExpectedStatus =
      hasAllAgents && expectedAgentTypes.every((agentType) => runs.find((entry) => entry.agentType === agentType)?.status === expectedStatus);

    if (hasExpectedStatus) {
      return runs.filter((entry) => expectedAgentTypes.includes(entry.agentType));
    }

    await sleep(config.pollMs);
  }

  const listed = await request(actors.ops, "GET", "/v1/agents/runs");
  const matching = listed.data.filter((entry) => entry.correlationId === correlationId);
  assert.fail(
    `Timed out waiting for correlationId=${correlationId} expectedStatus=${expectedStatus} runs=${JSON.stringify(matching)}`
  );
}

function summarizeRuns(runs) {
  return runs.map((run) => ({
    id: run.id,
    agentType: run.agentType,
    status: run.status,
    attempts: run.attempts
  }));
}

async function request(actor, method, path, body) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": config.tenantId,
      "x-user-id": actor.userId,
      "x-org-id": actor.orgId,
      "x-roles": actor.roles
    },
    body: method === "GET" || body === undefined ? undefined : JSON.stringify(body)
  });

  const json = await response.json();
  assert.ok(response.ok, `[${method}] ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  return json;
}

main().catch((error) => {
  console.error("[smoke:domain-events] failed", error);
  process.exit(1);
});
