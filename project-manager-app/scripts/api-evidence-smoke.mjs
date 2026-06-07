import assert from "node:assert/strict";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? "tnt_demo"
};

const actors = {
  client: {
    userId: "usr_evidence_client",
    orgId: "org_evidence_client",
    roles: "CLIENT"
  },
  ops: {
    userId: "usr_evidence_ops",
    orgId: "org_ops",
    roles: "OPS_ADMIN"
  },
  pro: {
    userId: "usr_evidence_pro",
    orgId: "org_pro_evidence",
    roles: "PRO"
  },
  outsider: {
    userId: "usr_evidence_outsider",
    orgId: "org_outsider",
    roles: "CLIENT"
  }
};

async function main() {
  console.log("[smoke:evidence] starting", config.apiBaseUrl);

  const { project, milestone } = await createProjectAndMilestone();

  const created = await request(actors.pro, "POST", "/v1/evidence", {
    projectId: project.id,
    milestoneId: milestone.id,
    key: `evidence/${Date.now()}-photo.jpg`,
    kind: "PHOTO"
  });

  assert.equal(created.data.projectId, project.id);
  assert.equal(created.data.milestoneId, milestone.id);

  const listByProject = await request(actors.pro, "GET", `/v1/projects/${project.id}/evidence`);
  assert.ok(listByProject.data.some((entry) => entry.id === created.data.id), "evidence should be listed for project");

  const detail = await request(actors.ops, "GET", `/v1/evidence/${created.data.id}`);
  assert.equal(detail.data.id, created.data.id);

  await assertForbidden(actors.outsider, "GET", `/v1/projects/${project.id}/evidence`);
  await assertForbidden(actors.outsider, "GET", `/v1/evidence/${created.data.id}`);
  await assertForbidden(actors.outsider, "POST", "/v1/evidence", {
    projectId: project.id,
    milestoneId: milestone.id,
    key: `evidence/${Date.now()}-blocked.jpg`,
    kind: "PHOTO"
  });

  console.log("[smoke:evidence] success", {
    projectId: project.id,
    milestoneId: milestone.id,
    evidenceId: created.data.id
  });
}

async function createProjectAndMilestone() {
  const job = await request(actors.client, "POST", "/v1/jobs", {
    title: `Evidence Job ${Date.now()}`,
    scope: "Flow to validate evidence ownership and reads.",
    budgetMin: 300,
    budgetMax: 900
  });

  const reservation = await request(actors.pro, "POST", `/v1/jobs/${job.data.id}/reservations`, {
    expiresInMinutes: 30
  });
  await request(actors.client, "POST", `/v1/reservations/${reservation.data.id}/accept`, {});

  const projects = await request(actors.ops, "GET", `/v1/projects?jobId=${encodeURIComponent(job.data.id)}`);
  const project = projects.data.find((entry) => entry.jobId === job.data.id);
  assert.ok(project, "project should exist");

  const milestone = await request(actors.ops, "POST", `/v1/projects/${project.id}/milestones`, {
    title: "Milestone evidencia",
    amount: 250,
    sequence: 1
  });

  return { project, milestone: milestone.data };
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
  console.error("[smoke:evidence] failed", error);
  process.exit(1);
});
