import assert from "node:assert/strict";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? "tnt_demo"
};

const actors = {
  client: {
    userId: "usr_projects_client",
    orgId: "org_projects_client",
    roles: "CLIENT"
  },
  ops: {
    userId: "usr_projects_ops",
    orgId: "org_ops",
    roles: "OPS_ADMIN"
  },
  outsider: {
    userId: "usr_projects_outsider",
    orgId: "org_outsider",
    roles: "CLIENT"
  },
  pro: {
    userId: "usr_projects_pro",
    orgId: "org_pro_projects",
    roles: "PRO"
  }
};

async function main() {
  console.log("[smoke:projects] starting", config.apiBaseUrl);

  const baseProject = await createProject();

  await assertForbidden(actors.outsider, "GET", `/v1/projects/${baseProject.id}`);
  await assertForbidden(actors.outsider, "GET", `/v1/projects/${baseProject.id}/payments`);
  await assertForbidden(actors.outsider, "GET", `/v1/projects/${baseProject.id}/escrow`);
  await assertForbidden(actors.outsider, "PATCH", `/v1/projects/${baseProject.id}/status`, {
    status: "in_progress"
  });

  const sameStatus = await request(actors.ops, "PATCH", `/v1/projects/${baseProject.id}/status`, {
    status: "open"
  });
  assert.equal(sameStatus.data.status, "open");

  const inProgress = await request(actors.ops, "PATCH", `/v1/projects/${baseProject.id}/status`, {
    status: "in_progress"
  });
  assert.equal(inProgress.data.status, "in_progress");

  const proDetail = await request(actors.pro, "GET", `/v1/projects/${baseProject.id}`);
  assert.equal(proDetail.data.id, baseProject.id);

  await assertForbidden(actors.pro, "PATCH", `/v1/projects/${baseProject.id}/status`, {
    status: "blocked"
  });
  await assertForbidden(actors.pro, "GET", `/v1/projects/${baseProject.id}/payments`);
  await assertForbidden(actors.pro, "GET", `/v1/projects/${baseProject.id}/escrow`);

  const milestone = await request(actors.ops, "POST", `/v1/projects/${baseProject.id}/milestones`, {
    title: "Milestone seguridad",
    amount: 500,
    sequence: 1
  });

  await request(actors.pro, "POST", "/v1/evidence", {
    projectId: baseProject.id,
    milestoneId: milestone.data.id,
    key: `evidence/${Date.now()}-projects-smoke.jpg`,
    kind: "PHOTO"
  });

  await request(actors.ops, "POST", `/v1/milestones/${milestone.data.id}/submit`, {});
  await request(actors.ops, "POST", `/v1/milestones/${milestone.data.id}/approve`, {});

  const invalidComplete = await requestExpectingFailure(actors.ops, "PATCH", `/v1/projects/${baseProject.id}/status`, {
    status: "completed"
  });
  assert.equal(invalidComplete.error.status, 409);

  await request(actors.ops, "POST", `/v1/projects/${baseProject.id}/escrow/deposit`, {
    amount: 500
  });

  await request(actors.ops, "POST", `/v1/milestones/${milestone.data.id}/escrow/release`, {});

  const completed = await request(actors.ops, "PATCH", `/v1/projects/${baseProject.id}/status`, {
    status: "completed"
  });
  assert.equal(completed.data.status, "completed");

  const audit = await request(actors.ops, "GET", "/v1/ops/audit");
  const statusAudits = audit.data.filter(
    (entry) => entry.entityId === baseProject.id && entry.action === "project.status.update"
  );
  assert.ok(statusAudits.length >= 2, "expected project status audit entries for transitions");

  const cancelProject = await createProject();
  await request(actors.ops, "POST", `/v1/projects/${cancelProject.id}/escrow/deposit`, {
    amount: 300
  });

  const invalidCancel = await requestExpectingFailure(actors.ops, "PATCH", `/v1/projects/${cancelProject.id}/status`, {
    status: "cancelled"
  });
  assert.equal(invalidCancel.error.status, 409);

  console.log("[smoke:projects] success", {
    securedProjectId: baseProject.id,
    cancelledProjectId: cancelProject.id
  });
}

async function createProject() {
  const job = await request(actors.client, "POST", "/v1/jobs", {
    title: `Projects Security Job ${Date.now()}`,
    scope: "Flow to validate project ownership, lifecycle and financial access.",
    budgetMin: 500,
    budgetMax: 1200
  });

  const bid = await request(actors.pro, "POST", `/v1/jobs/${job.data.id}/bids`, {
    proOrgId: actors.pro.orgId,
    amount: 900,
    etaDays: 4
  });

  await request(actors.client, "POST", `/v1/bids/${bid.data.id}/accept`, {});

  const contract = await request(actors.client, "POST", `/v1/jobs/${job.data.id}/contracts`, {
    termsJson: {
      currency: "USD",
      milestoneModel: "single",
      releasePolicy: "approved_milestone_only"
    }
  });

  await request(actors.client, "POST", `/v1/contracts/${contract.data.id}/sign`, {
    documentHash: `projects-smoke-${job.data.id}`,
    pdfUrl: "https://example.com/contracts/projects-smoke.pdf"
  });

  await request(actors.pro, "POST", `/v1/contracts/${contract.data.id}/sign`, {
    documentHash: `projects-smoke-${job.data.id}`
  });

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
  console.error("[smoke:projects] failed", error);
  process.exit(1);
});
