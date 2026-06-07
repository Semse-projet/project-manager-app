import assert from "node:assert/strict";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? "tnt_demo"
};

const actors = {
  client: {
    userId: "usr_escrow_client",
    orgId: "org_escrow_client",
    roles: "CLIENT"
  },
  pro: {
    userId: "usr_escrow_pro",
    orgId: "org_escrow_pro",
    roles: "PRO"
  },
  ops: {
    userId: "usr_escrow_ops",
    orgId: "org_ops",
    roles: "OPS_ADMIN"
  }
};

async function main() {
  console.log("[smoke:escrow-contract] starting", config.apiBaseUrl);

  const job = await request(actors.client, "POST", "/v1/jobs", {
    title: `Escrow Contract Job ${Date.now()}`,
    scope: "Smoke test for contract-gated escrow funding.",
    budgetMin: 900,
    budgetMax: 2200
  });

  const reservation = await request(actors.pro, "POST", `/v1/jobs/${job.data.id}/reservations`, {
    expiresInMinutes: 30
  });
  await request(actors.client, "POST", `/v1/reservations/${reservation.data.id}/accept`, {});

  await assertConflict(actors.client, "POST", `/v1/jobs/${job.data.id}/escrow/fund`, {
    amount: 500,
    currency: "USD"
  });

  const contract = await request(actors.client, "POST", `/v1/jobs/${job.data.id}/contracts`, {
    termsJson: {
      currency: "USD",
      releasePolicy: "approved_milestone_only"
    }
  });

  await assertConflict(actors.client, "POST", `/v1/jobs/${job.data.id}/escrow/fund`, {
    amount: 500,
    currency: "USD"
  });

  await request(actors.client, "POST", `/v1/contracts/${contract.data.id}/sign`, {
    documentHash: "1234567890abcdef-escrow",
    pdfUrl: "https://example.com/contracts/escrow-canonical.pdf"
  });

  await assertConflict(actors.client, "POST", `/v1/jobs/${job.data.id}/escrow/fund`, {
    amount: 500,
    currency: "USD"
  });

  await request(actors.pro, "POST", `/v1/contracts/${contract.data.id}/sign`, {
    documentHash: "1234567890abcdef-escrow",
    pdfUrl: "https://example.com/contracts/escrow-canonical.pdf"
  });

  const funded = await request(actors.client, "POST", `/v1/jobs/${job.data.id}/escrow/fund`, {
    amount: 500,
    currency: "USD"
  });
  assert.equal(funded.data.transaction.type, "FUND");
  assert.equal(funded.data.contract.id, contract.data.id);

  const projectList = await request(actors.ops, "GET", `/v1/projects?jobId=${encodeURIComponent(job.data.id)}`);
  const project = projectList.data.find((entry) => entry.jobId === job.data.id);
  assert.ok(project, "project bridge should exist for funded escrow flow");

  const milestone = await request(actors.ops, "POST", `/v1/projects/${project.id}/milestones`, {
    title: "Escrow Release Milestone",
    amount: 200,
    sequence: 1
  });
  await request(actors.pro, "POST", "/v1/evidence", {
    projectId: project.id,
    milestoneId: milestone.data.id,
    key: `evidence/${Date.now()}-escrow-contract-smoke.jpg`,
    kind: "PHOTO"
  });
  await request(actors.pro, "POST", `/v1/milestones/${milestone.data.id}/submit`, {});
  await request(actors.client, "POST", `/v1/milestones/${milestone.data.id}/approve`, {});

  const released = await request(actors.client, "POST", `/v1/milestones/${milestone.data.id}/escrow/release`, {});
  assert.equal(released.data.transaction.type, "RELEASE");

  const escrow = await request(actors.pro, "GET", `/v1/jobs/${job.data.id}/escrow`);
  assert.equal(escrow.data.contract.id, contract.data.id);
  assert.equal(escrow.data.totalDeposited, 500);
  assert.equal(escrow.data.totalReleased, 200);
  assert.equal(escrow.data.available, 300);

  const audit = await request(actors.ops, "GET", "/v1/ops/audit");
  assert.ok(audit.data.some((entry) => entry.entityId === contract.data.id && entry.action === "escrow.fund.by_job"));
  assert.ok(audit.data.some((entry) => entry.entityId === released.data.transaction.id && entry.action === "escrow.release"));

  console.log("[smoke:escrow-contract] success", {
    jobId: job.data.id,
    contractId: contract.data.id,
    escrowId: funded.data.escrow.id,
    milestoneId: milestone.data.id
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

async function assertConflict(actor, method, path, body) {
  const response = await requestExpectingFailure(actor, method, path, body);
  assert.equal(response.error.status, 409);
}

main().catch((error) => {
  console.error("[smoke:escrow-contract] failed", error);
  process.exit(1);
});
