// F01 Marketplace: Bid -> Accept real HTTP + PostgreSQL integration canary.
// CI-only: uses an ephemeral postgres:16 service and the local API started by api-integration.yml.
// This is NOT a real-user/JWT production E2E and NEVER calls financial endpoints.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = new URL(process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000");
assert.equal(process.env.CI, "true", "F01 HTTP smoke must run in CI");
assert.equal(process.env.SEMSE_F01_ISOLATED_DB, "1", "Explicit ephemeral DB opt-in required");
assert.equal(process.env.NODE_ENV === "production", false, "Never run under production mode");
assert.equal(base.protocol, "http:", "Only local HTTP is allowed");
assert.ok(["localhost", "127.0.0.1", "::1"].includes(base.hostname), "API must bind to loopback");
assert.equal(base.port || "80", "4000", "Unexpected API port");

const runId = randomUUID().slice(0, 12);
const tenantA = "test_f01_" + runId;
const tenantB = "test_f01_other_" + runId;
const client = actor(tenantA, "client", "CLIENT");
const pro1 = actor(tenantA, "pro1", "PRO");
const pro2 = actor(tenantA, "pro2", "PRO");
const otherClient = actor(tenantA, "other_client", "CLIENT");
const foreignClient = actor(tenantB, "client", "CLIENT");
const ops = actor(tenantA, "ops", "OPS_ADMIN");

function actor(tenantId, label, roles) {
  return {
    tenantId,
    userId: "test_f01_user_" + label + "_" + runId,
    orgId: "test_f01_org_" + label + "_" + runId,
    roles,
  };
}

async function request(identity, method, path, body, status) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": identity.tenantId,
      "x-user-id": identity.userId,
      "x-org-id": identity.orgId,
      "x-roles": identity.roles,
      "x-request-id": "f01-" + randomUUID(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (status !== undefined) {
    assert.equal(response.status, status, method + " " + path + " expected " + status + ", got " + response.status);
  } else {
    assert.ok(response.ok, method + " " + path + ": " + response.status + " " + JSON.stringify(result));
  }
  return result.data;
}

async function main() {
  const job = await request(client, "POST", "/v1/jobs", {
    title: "TEST F01 marketplace " + runId,
    scope: "Synthetic Marketplace bid acceptance and ownership integration test",
    budgetMin: 900,
    budgetMax: 1600,
  });
  assert.ok(job.id);
  assert.equal(job.status.toLowerCase(), "posted");

  const bid1 = await request(pro1, "POST", "/v1/jobs/" + job.id + "/bids", {
    proOrgId: pro1.orgId,
    amount: 1200,
    etaDays: 5,
  });
  const bid2 = await request(pro2, "POST", "/v1/jobs/" + job.id + "/bids", {
    proOrgId: pro2.orgId,
    amount: 1400,
    etaDays: 7,
  });
  assert.equal(bid1.jobId, job.id);
  assert.equal(bid2.jobId, job.id);
  assert.notEqual(bid1.id, bid2.id);

  const proposals = await request(client, "GET", "/v1/jobs/" + job.id + "/bids");
  assert.equal(proposals.filter((b) => b.jobId === job.id).length, 2);

  // Rejected requests must not create an accepted bid.
  await request(otherClient, "POST", "/v1/bids/" + bid1.id + "/accept", {}, 403);
  await request(foreignClient, "POST", "/v1/bids/" + bid1.id + "/accept", {}, 404);

  const chosen = await request(client, "POST", "/v1/bids/" + bid1.id + "/accept", {});
  assert.equal(chosen.id, bid1.id);
  assert.equal(chosen.status.toLowerCase(), "accepted");

  const after = await request(client, "GET", "/v1/jobs/" + job.id + "/bids");
  assert.equal(after.find((b) => b.id === bid1.id)?.status?.toLowerCase(), "accepted");
  assert.equal(after.find((b) => b.id === bid2.id)?.status?.toLowerCase(), "rejected");
  const acceptedJob = await request(client, "GET", "/v1/jobs/" + job.id);
  assert.equal(acceptedJob.status.toLowerCase(), "accepted");

  const projects = await request(ops, "GET", "/v1/projects?jobId=" + encodeURIComponent(job.id));
  const project = projects.find((row) => row.jobId === job.id);
  assert.ok(project, "accepting a bid must materialize a Project");
  assert.equal(project.assignedProOrgId, pro1.orgId);

  // A rejected competing bid cannot displace the winner.
  await request(client, "POST", "/v1/bids/" + bid2.id + "/accept", {}, 409);
  const afterRejection = await request(client, "GET", "/v1/jobs/" + job.id + "/bids");
  assert.equal(afterRejection.filter((b) => b.status.toLowerCase() === "accepted").length, 1);

  console.log("[F01] HTTP/Postgres synthetic bid acceptance passed", {
    runId, jobId: job.id, bidId: bid1.id, projectId: project.id,
    realAuthVerified: false, realPaymentsVerified: false,
  });
}

main().catch((error) => {
  console.error("[F01] failed", error);
  process.exitCode = 1;
});
