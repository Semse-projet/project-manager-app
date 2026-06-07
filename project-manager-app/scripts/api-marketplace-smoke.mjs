import assert from "node:assert/strict";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? "tnt_demo"
};

const actors = {
  client: {
    userId: "usr_market_client",
    orgId: "org_market_client",
    roles: "CLIENT"
  },
  pro: {
    userId: "usr_market_pro",
    orgId: "org_market_pro",
    roles: "PRO"
  },
  ops: {
    userId: "usr_market_ops",
    orgId: "org_ops",
    roles: "OPS_ADMIN"
  }
};

async function main() {
  console.log("[smoke:marketplace] starting", config.apiBaseUrl);

  const job = await request(actors.client, "POST", "/v1/jobs", {
    title: `Marketplace Job ${Date.now()}`,
    scope: "Smoke test flow for job, reservation, contract and project bridge.",
    budgetMin: 500,
    budgetMax: 1200
  });

  const reservation = await request(actors.pro, "POST", `/v1/jobs/${job.data.id}/reservations`, {
    expiresInMinutes: 30
  });
  assert.equal(reservation.data.status, "active");

  const reservations = await request(actors.client, "GET", `/v1/jobs/${job.data.id}/reservations`);
  assert.ok(reservations.data.some((entry) => entry.id === reservation.data.id), "created reservation should be listed");

  const accepted = await request(actors.client, "POST", `/v1/reservations/${reservation.data.id}/accept`, {});
  assert.equal(accepted.data.status, "accepted");

  const contract = await request(actors.client, "POST", `/v1/jobs/${job.data.id}/contracts`, {
    termsJson: {
      currency: "USD",
      releasePolicy: "approved_milestone_only"
    }
  });
  assert.equal(contract.data.jobId, job.data.id);

  const projects = await request(actors.ops, "GET", `/v1/projects?jobId=${encodeURIComponent(job.data.id)}`);
  const project = projects.data.find((entry) => entry.jobId === job.data.id);
  assert.ok(project, "project should be auto-created after accepting reservation");
  assert.equal(project.assignedProOrgId, actors.pro.orgId);

  const audit = await request(actors.ops, "GET", "/v1/ops/audit");
  assert.ok(audit.data.some((entry) => entry.entityId === reservation.data.id && entry.action === "reservation.create"));
  assert.ok(audit.data.some((entry) => entry.entityId === reservation.data.id && entry.action === "reservation.accept"));
  assert.ok(audit.data.some((entry) => entry.entityId === contract.data.id && entry.action === "contract.create"));

  console.log("[smoke:marketplace] success", {
    jobId: job.data.id,
    reservationId: reservation.data.id,
    contractId: contract.data.id,
    projectId: project.id
  });
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
  console.error("[smoke:marketplace] failed", error);
  process.exit(1);
});
