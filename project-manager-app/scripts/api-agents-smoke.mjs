import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? `tnt_agents_smoke_${Date.now()}`,
  userId: process.env.SEMSE_USER_ID ?? "usr_agents_001",
  orgId: process.env.SEMSE_ORG_ID ?? "org_ops",
  roles: process.env.SEMSE_ROLES ?? "OPS_ADMIN,WORKER"
};

async function main() {
  console.log("[smoke:agents] starting", config.apiBaseUrl);

  const created = await request("POST", "/v1/agents/runs", {
    agentType: "risk",
    triggerType: "manual",
    correlationId: `agents-smoke-${Date.now()}`,
    maxAttempts: 2
  });
  assert.equal(created.data.status, "queued");

  const claimed = await request("POST", "/v1/agents/runs/claim", {
    workerId: "worker-smoke-001",
    agentType: "risk"
  });
  assert.equal(claimed.data.id, created.data.id);
  assert.equal(claimed.data.status, "running");
  assert.equal(claimed.data.attempts, 1);

  const heartbeat = await request("POST", `/v1/agents/runs/${created.data.id}/heartbeat`, {
    workerId: "worker-smoke-001"
  });
  assert.equal(heartbeat.data.status, "running");

  const failed = await request("POST", `/v1/agents/runs/${created.data.id}/fail`, {
    error: "simulated failure for smoke test"
  });
  assert.equal(failed.data.status, "failed");

  const retried = await request("POST", `/v1/agents/runs/${created.data.id}/retry`, {});
  assert.equal(retried.data.status, "queued");

  const claimedAgain = await request("POST", "/v1/agents/runs/claim", {
    workerId: "worker-smoke-001",
    agentType: "risk"
  });
  assert.equal(claimedAgain.data.id, created.data.id);
  assert.equal(claimedAgain.data.status, "running");
  assert.equal(claimedAgain.data.attempts, 2);

  const completed = await request("POST", `/v1/agents/runs/${created.data.id}/complete`, {
    output: { summary: "completed by smoke test" }
  });
  assert.equal(completed.data.status, "completed");

  const staleRun = await request("POST", "/v1/agents/runs", {
    agentType: "dispute",
    triggerType: "manual",
    correlationId: `agents-stale-${Date.now()}`,
    maxAttempts: 1
  });

  await request("POST", "/v1/agents/runs/claim", {
    workerId: "worker-smoke-002",
    agentType: "dispute"
  });
  await sleep(10);

  const reclaimed = await request("POST", "/v1/agents/runs/reclaim-stale", {
    staleAfterMs: 1,
    maxItems: 10
  });
  assert.ok(reclaimed.data.reclaimedCount >= 1);
  const reclaimedRun = reclaimed.data.runs.find((entry) => entry.id === staleRun.data.id);
  assert.ok(reclaimedRun, "stale run should be reclaimed");
  assert.equal(reclaimedRun.deadLettered, true);
  assert.equal(reclaimedRun.status, "failed");

  const listed = await request("GET", "/v1/agents/runs");
  assert.ok(listed.data.some((entry) => entry.id === created.data.id));
  assert.ok(listed.data.some((entry) => entry.id === staleRun.data.id));

  const audit = await request("GET", "/v1/ops/audit");
  assert.ok(audit.data.some((entry) => entry.entityId === created.data.id && entry.action === "agent.run.create"));
  assert.ok(audit.data.some((entry) => entry.entityId === created.data.id && entry.action === "agent.run.complete"));
  assert.ok(audit.data.some((entry) => entry.entityId.includes(staleRun.data.id) && entry.action === "agent.run.reclaim_stale"));

  console.log("[smoke:agents] success", {
    completedRunId: created.data.id,
    reclaimedRunId: staleRun.data.id
  });
}

async function request(method, path, body) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": config.tenantId,
      "x-user-id": config.userId,
      "x-org-id": config.orgId,
      "x-roles": config.roles
    },
    body: method === "GET" || body === undefined ? undefined : JSON.stringify(body)
  });

  const json = await response.json();
  assert.ok(response.ok, `[${method}] ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  return json;
}

main().catch((error) => {
  console.error("[smoke:agents] failed", error);
  process.exit(1);
});
