import assert from "node:assert/strict";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? "tnt_demo"
};

const actors = {
  client: {
    userId: "usr_contract_client",
    orgId: "org_contract_client",
    roles: "CLIENT"
  },
  pro: {
    userId: "usr_contract_pro",
    orgId: "org_contract_pro",
    roles: "PRO"
  },
  ops: {
    userId: "usr_contract_ops",
    orgId: "org_ops",
    roles: "OPS_ADMIN"
  }
};

async function main() {
  console.log("[smoke:contracts] starting", config.apiBaseUrl);

  const job = await request(actors.client, "POST", "/v1/jobs", {
    title: `Contract Job ${Date.now()}`,
    scope: "Smoke test for reservation to contract flow.",
    budgetMin: 800,
    budgetMax: 2100
  });

  const reservation = await request(actors.pro, "POST", `/v1/jobs/${job.data.id}/reservations`, {
    expiresInMinutes: 30
  });
  await request(actors.client, "POST", `/v1/reservations/${reservation.data.id}/accept`, {});

  const created = await request(actors.client, "POST", `/v1/jobs/${job.data.id}/contracts`, {
    termsJson: {
      currency: "USD",
      milestoneModel: "single",
      releasePolicy: "approved_milestone_only"
    }
  });

  assert.equal(created.data.jobId, job.data.id);
  assert.equal(created.data.clientOrgId, actors.client.orgId);
  assert.equal(created.data.professionalOrgId, actors.pro.orgId);

  const currentForPro = await request(actors.pro, "GET", `/v1/jobs/${job.data.id}/contracts/current`);
  assert.equal(currentForPro.data.id, created.data.id);

  const canonicalPdfUrl = "https://example.com/contracts/canonical.pdf";
  const canonicalDocumentHash = "1234567890abcdef-canonical";

  const clientSigned = await request(actors.client, "POST", `/v1/contracts/${created.data.id}/sign`, {
    documentHash: canonicalDocumentHash,
    pdfUrl: canonicalPdfUrl
  });
  assert.ok(clientSigned.data.signedClientAt, "client signature should be recorded");
  assert.equal(clientSigned.data.documentHash, canonicalDocumentHash);
  assert.equal(clientSigned.data.pdfUrl, canonicalPdfUrl);

  const fullySigned = await request(actors.pro, "POST", `/v1/contracts/${created.data.id}/sign`, {
    documentHash: canonicalDocumentHash
  });
  assert.ok(fullySigned.data.signedClientAt, "client signature should persist");
  assert.ok(fullySigned.data.signedProAt, "pro signature should be recorded");
  assert.equal(fullySigned.data.documentHash, canonicalDocumentHash);
  assert.equal(fullySigned.data.pdfUrl, canonicalPdfUrl);

  const byId = await request(actors.pro, "GET", `/v1/contracts/${created.data.id}`);
  assert.equal(byId.data.id, created.data.id);

  const audit = await request(actors.ops, "GET", "/v1/ops/audit");
  assert.ok(audit.data.some((entry) => entry.entityId === created.data.id && entry.action === "contract.create"));
  assert.ok(audit.data.some((entry) => entry.entityId === created.data.id && entry.action === "contract.sign"));

  console.log("[smoke:contracts] success", { jobId: job.data.id, contractId: created.data.id });
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
  console.error("[smoke:contracts] failed", error);
  process.exit(1);
});
