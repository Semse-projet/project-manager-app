import assert from "node:assert/strict";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? "tnt_demo"
};

const actors = {
  client: {
    userId: "usr_res_client",
    orgId: "org_res_client",
    roles: "CLIENT"
  },
  pro: {
    userId: "usr_res_pro",
    orgId: "org_res_pro",
    roles: "PRO"
  },
  outsider: {
    userId: "usr_res_outsider",
    orgId: "org_res_outsider",
    roles: "CLIENT"
  },
  ops: {
    userId: "usr_res_ops",
    orgId: "org_ops",
    roles: "OPS_ADMIN"
  }
};

async function main() {
  console.log("[smoke:reservations] starting", config.apiBaseUrl);

  const job = await request(actors.client, "POST", "/v1/jobs", {
    title: `Reservation Job ${Date.now()}`,
    scope: "Smoke test flow for explicit reservations module.",
    budgetMin: 600,
    budgetMax: 1600
  });

  const created = await request(actors.pro, "POST", `/v1/jobs/${job.data.id}/reservations`, {
    expiresInMinutes: 45
  });
  assert.equal(created.data.status, "ACTIVE");
  assert.equal(created.data.professionalOrgId, actors.pro.orgId);

  const listedByClient = await request(actors.client, "GET", `/v1/jobs/${job.data.id}/reservations`);
  assert.ok(listedByClient.data.some((entry) => entry.id === created.data.id), "client should see reservation");

  const listedByPro = await request(actors.pro, "GET", `/v1/jobs/${job.data.id}/reservations`);
  assert.ok(listedByPro.data.some((entry) => entry.id === created.data.id), "pro should see reservation");

  await assertForbidden(actors.outsider, "GET", `/v1/jobs/${job.data.id}/reservations`);

  await assertForbidden(actors.pro, "POST", `/v1/reservations/${created.data.id}/accept`, {});

  const accepted = await request(actors.client, "POST", `/v1/reservations/${created.data.id}/accept`, {});
  assert.equal(accepted.data.status, "ACCEPTED");

  const jobDetail = await request(actors.client, "GET", `/v1/jobs/${job.data.id}`);
  assert.equal(jobDetail.data.status, "ACCEPTED");

  const projects = await request(actors.ops, "GET", `/v1/projects?jobId=${encodeURIComponent(job.data.id)}`);
  const project = projects.data.find((entry) => entry.jobId === job.data.id);
  assert.ok(project, "project should be created as transitional bridge after reservation acceptance");
  assert.equal(project.assignedProOrgId, actors.pro.orgId);

  const audit = await request(actors.ops, "GET", "/v1/ops/audit");
  assert.ok(audit.data.some((entry) => entry.entityId === created.data.id && entry.action === "reservation.create"));
  assert.ok(audit.data.some((entry) => entry.entityId === created.data.id && entry.action === "reservation.accept"));

  console.log("[smoke:reservations] success", {
    jobId: job.data.id,
    reservationId: created.data.id,
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

async function requestExpectingFailure(actor, method, path, body) {
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
  assert.equal(response.ok, false, `[${method}] ${path} unexpectedly succeeded`);
  return json;
}

async function assertForbidden(actor, method, path, body) {
  const response = await requestExpectingFailure(actor, method, path, body);
  assert.equal(response.error.status, 403);
}

main().catch((error) => {
  console.error("[smoke:reservations] failed", error);
  process.exit(1);
});
