import assert from "node:assert/strict";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? "tnt_demo",
};

const actors = {
  client: {
    userId: "usr_dispute_client",
    orgId: "org_dispute_client",
    roles: "CLIENT"
  },
  ops: {
    userId: process.env.SEMSE_USER_ID ?? "usr_dispute_001",
    orgId: process.env.SEMSE_ORG_ID ?? "org_ops",
    roles: process.env.SEMSE_ROLES ?? "OPS_ADMIN"
  },
  pro: {
    userId: "usr_dispute_pro",
    orgId: "org_pro_dispute",
    roles: "PRO"
  },
  outsider: {
    userId: "usr_dispute_outsider",
    orgId: "org_outsider",
    roles: "CLIENT"
  }
};

async function main() {
  console.log("[smoke:disputes] starting", config.apiBaseUrl);

  const project = await createProject();
  const created = await request(actors.ops, "POST", "/v1/disputes", {
    projectId: project.id,
    reason: "Cliente y proveedor no coinciden sobre la aprobación del trabajo."
  });

  assert.equal(created.data.status, "OPEN");

  const duplicate = await requestExpectingFailure(actors.ops, "POST", "/v1/disputes", {
    projectId: project.id,
    reason: "Intento duplicado de disputa abierta."
  });
  assert.equal(duplicate.error.status, 409);

  const opsList = await request(actors.ops, "GET", "/v1/disputes");
  assert.ok(opsList.data.some((entry) => entry.id === created.data.id), "ops should list dispute");

  const proList = await request(actors.pro, "GET", "/v1/disputes");
  assert.ok(proList.data.some((entry) => entry.id === created.data.id), "assigned pro org should list dispute");

  const outsiderList = await request(actors.outsider, "GET", "/v1/disputes");
  assert.equal(
    outsiderList.data.some((entry) => entry.id === created.data.id),
    false,
    "outsider should not see dispute in list"
  );
  await assertForbidden(actors.outsider, "POST", "/v1/disputes", {
    projectId: project.id,
    reason: "Intento de abrir disputa sin ownership."
  });

  const assigned = await request(actors.ops, "POST", `/v1/disputes/${created.data.id}/assign`, {
    assigneeUserId: "usr_dispute_reviewer"
  });
  assert.equal(assigned.data.status, "ASSIGNED");
  assert.equal(assigned.data.assigneeUserId, "usr_dispute_reviewer");

  const resolved = await request(actors.ops, "POST", `/v1/disputes/${created.data.id}/resolve`, {
    resolution: "Se revisó evidencia y se resolvió a favor del proveedor."
  });
  assert.equal(resolved.data.status, "RESOLVED");
  assert.equal(resolved.data.assigneeUserId, "usr_dispute_reviewer");
  assert.equal(resolved.data.resolvedByUserId, actors.ops.userId);

  const list = await request(actors.ops, "GET", "/v1/disputes");
  const dispute = list.data.find((entry) => entry.id === created.data.id);
  assert.ok(dispute, "resolved dispute should be listed");
  assert.equal(dispute.status, "RESOLVED");

  const audit = await request(actors.ops, "GET", "/v1/ops/audit");
  assert.ok(audit.data.some((entry) => entry.entityId === created.data.id && entry.action === "dispute.create"));
  assert.ok(audit.data.some((entry) => entry.entityId === created.data.id && entry.action === "dispute.assign"));
  assert.ok(audit.data.some((entry) => entry.entityId === created.data.id && entry.action === "dispute.resolve"));

  console.log("[smoke:disputes] success", { projectId: project.id, disputeId: created.data.id });
}

async function createProject() {
  const job = await request(actors.client, "POST", "/v1/jobs", {
    title: `Dispute Job ${Date.now()}`,
    scope: "Smoke test flow for disputes persisted in PostgreSQL.",
    budgetMin: 700,
    budgetMax: 1600
  });

  const reservation = await request(actors.pro, "POST", `/v1/jobs/${job.data.id}/reservations`, {
    expiresInMinutes: 30
  });
  await request(actors.client, "POST", `/v1/reservations/${reservation.data.id}/accept`, {});

  const projects = await request(actors.ops, "GET", `/v1/projects?jobId=${encodeURIComponent(job.data.id)}`);
  const project = projects.data.find((entry) => entry.jobId === job.data.id);
  assert.ok(project, "project should exist");

  return project;
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
    body: JSON.stringify(body)
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
  console.error("[smoke:disputes] failed", error);
  process.exit(1);
});
