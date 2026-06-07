import assert from "node:assert/strict";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? "tnt_demo"
};

const actors = {
  client: {
    userId: "usr_milestone_client",
    orgId: "org_milestone_client",
    roles: "CLIENT"
  },
  pro: {
    userId: "usr_milestone_pro",
    orgId: "org_milestone_pro",
    roles: "PRO"
  },
  ops: {
    userId: "usr_milestone_ops",
    orgId: "org_ops",
    roles: "OPS_ADMIN"
  }
};

async function main() {
  console.log("[smoke:milestones] starting", config.apiBaseUrl);

  const job = await request(actors.client, "POST", "/v1/jobs", {
    title: `Milestone Job ${Date.now()}`,
    scope: "Smoke test flow for persisted milestones in PostgreSQL.",
    budgetMin: 800,
    budgetMax: 1800
  });

  const reservation = await request(actors.pro, "POST", `/v1/jobs/${job.data.id}/reservations`, {
    expiresInMinutes: 45
  });
  await request(actors.client, "POST", `/v1/reservations/${reservation.data.id}/accept`, {});

  const contract = await request(actors.client, "POST", `/v1/jobs/${job.data.id}/contracts`, {
    termsJson: {
      currency: "USD",
      releasePolicy: "approved_milestone_only"
    }
  });
  await request(actors.client, "POST", `/v1/contracts/${contract.data.id}/sign`, {
    documentHash: "1234567890abcdef-milestone",
    pdfUrl: "https://example.com/contracts/milestone.pdf"
  });

  const projects = await request(actors.ops, "GET", `/v1/projects?jobId=${encodeURIComponent(job.data.id)}`);
  const project = projects.data.find((entry) => entry.jobId === job.data.id);
  assert.ok(project, "project should exist");

  const created = await request(actors.ops, "POST", `/v1/projects/${project.id}/milestones`, {
    title: "Primer hito",
    amount: 600,
    sequence: 1
  });
  assert.equal(created.data.status, "DRAFT");

  await request(actors.pro, "POST", "/v1/evidence", {
    projectId: project.id,
    milestoneId: created.data.id,
    key: `evidence/${Date.now()}-milestones-smoke.jpg`,
    kind: "PHOTO"
  });

  const submitted = await request(actors.pro, "POST", `/v1/milestones/${created.data.id}/submit`, {});
  assert.equal(submitted.data.status, "SUBMITTED");

  const approved = await request(actors.client, "POST", `/v1/milestones/${created.data.id}/approve`, {});
  assert.equal(approved.data.status, "APPROVED");

  const list = await request(actors.client, "GET", `/v1/projects/${project.id}/milestones`);
  const milestone = list.data.find((entry) => entry.id === created.data.id);
  assert.ok(milestone, "milestone should be listed");
  assert.equal(milestone.status, "APPROVED");

  const audit = await request(actors.ops, "GET", "/v1/ops/audit");
  assert.ok(audit.data.some((entry) => entry.entityId === created.data.id && entry.action === "milestone.create"));
  assert.ok(audit.data.some((entry) => entry.entityId === created.data.id && entry.action === "milestone.submit"));
  assert.ok(audit.data.some((entry) => entry.entityId === created.data.id && entry.action === "milestone.approve"));

  console.log("[smoke:milestones] success", { projectId: project.id, milestoneId: created.data.id });
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
  console.error("[smoke:milestones] failed", error);
  process.exit(1);
});
