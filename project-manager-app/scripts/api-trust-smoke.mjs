import assert from "node:assert/strict";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? "tnt_demo"
};

const actors = {
  client: {
    userId: "usr_trust_client",
    orgId: "org_trust_client",
    roles: "CLIENT"
  },
  pro: {
    userId: "usr_trust_pro",
    orgId: "org_trust_pro",
    roles: "PRO"
  },
  ops: {
    userId: "usr_trust_ops",
    orgId: "org_trust_ops",
    roles: "OPS_ADMIN"
  },
  outsider: {
    userId: "usr_trust_outsider",
    orgId: "org_trust_outsider",
    roles: "CLIENT"
  }
};

async function main() {
  console.log("[smoke:trust] starting", config.apiBaseUrl);

  const job = await request(actors.client, "POST", "/v1/jobs", {
    title: `Trust Job ${Date.now()}`,
    scope: "Smoke test for trust signals with contract, milestone and dispute.",
    budgetMin: 900,
    budgetMax: 2400
  });

  const reservation = await request(actors.pro, "POST", `/v1/jobs/${job.data.id}/reservations`, {
    expiresInMinutes: 30
  });
  await request(actors.client, "POST", `/v1/reservations/${reservation.data.id}/accept`, {});

  const contract = await request(actors.client, "POST", `/v1/jobs/${job.data.id}/contracts`, {
    termsJson: {
      currency: "USD",
      releasePolicy: "approved_milestone_only"
    }
  });

  const milestone = await request(actors.client, "POST", `/v1/jobs/${job.data.id}/milestones`, {
    title: "Trust checkpoint",
    amount: 450,
    sequence: 1
  });

  await request(actors.pro, "POST", "/v1/evidence", {
    milestoneId: milestone.data.id,
    kind: "PHOTO",
    key: `trust/${Date.now()}.jpg`
  });

  await request(actors.pro, "POST", `/v1/milestones/${milestone.data.id}/submit`, {});
  await request(actors.ops, "POST", `/v1/milestones/${milestone.data.id}/reject`, {
    reason: "Evidence requires clarification."
  });

  const projects = await request(actors.client, "GET", `/v1/projects?jobId=${job.data.id}`);
  assert.equal(projects.data.length, 1, "job should resolve to a single project");
  const projectId = projects.data[0].id;

  await request(actors.client, "POST", "/v1/disputes", {
    projectId,
    reason: "Trust smoke keeps one dispute open to test the score."
  });

  const trustByJob = await request(actors.client, "GET", `/v1/jobs/${job.data.id}/trust`);
  assert.equal(trustByJob.data.scopeType, "job");
  assert.equal(trustByJob.data.jobId, job.data.id);
  assert.equal(trustByJob.data.projectId, projectId);
  assert.ok(trustByJob.data.flags.includes("missing_client_signature"));
  assert.ok(trustByJob.data.flags.includes("missing_professional_signature"));
  assert.ok(trustByJob.data.flags.includes("milestone_rejected"));
  assert.ok(trustByJob.data.flags.includes("open_dispute"));
  assert.equal(trustByJob.data.signals.contract.exists, true);
  assert.equal(trustByJob.data.signals.milestones.rejected, 1);
  assert.equal(trustByJob.data.signals.disputes.open, 1);

  const trustByProject = await request(actors.pro, "GET", `/v1/projects/${projectId}/trust`);
  assert.equal(trustByProject.data.scopeType, "project");
  assert.equal(trustByProject.data.projectId, projectId);

  const trustForOps = await request(actors.ops, "GET", `/v1/jobs/${job.data.id}/trust`);
  assert.equal(trustForOps.data.jobId, job.data.id);

  const outsider = await rawRequest(actors.outsider, "GET", `/v1/jobs/${job.data.id}/trust`);
  assert.ok(!outsider.response.ok, "outsider should not read trust");
  assert.ok([403, 404].includes(outsider.response.status), "outsider should receive 403 or 404");

  console.log("[smoke:trust] success", {
    jobId: job.data.id,
    projectId,
    contractId: contract.data.id,
    score: trustByJob.data.score,
    flags: trustByJob.data.flags
  });
}

async function request(actor, method, path, body) {
  const { response, json } = await rawRequest(actor, method, path, body);
  assert.ok(response.ok, `[${method}] ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  return json;
}

async function rawRequest(actor, method, path, body) {
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

  const json = await response.json().catch(() => null);
  return { response, json };
}

main().catch((error) => {
  console.error("[smoke:trust] failed", error);
  process.exit(1);
});
