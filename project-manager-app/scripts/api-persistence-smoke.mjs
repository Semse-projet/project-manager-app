import assert from "node:assert/strict";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? "tnt_demo",
  userId: process.env.SEMSE_USER_ID ?? "usr_smoke_001",
  orgId: process.env.SEMSE_ORG_ID ?? "org_ops",
  roles: process.env.SEMSE_ROLES ?? "OPS_ADMIN"
};

async function main() {
  console.log("[smoke:persistence] starting", config.apiBaseUrl);

  const health = await request("GET", "/v1/health");
  assert.equal(health.data.persistence, "prisma", "API should run in prisma mode");

  const createPayload = {
    title: `Smoke Job ${Date.now()}`,
    scope: "Smoke test job for persisted creation and listing in PostgreSQL.",
    budgetMin: 100,
    budgetMax: 250
  };

  const created = await request("POST", "/v1/jobs", createPayload);
  assert.equal(created.data.status, "posted");
  assert.equal(created.data.title, createPayload.title);

  const list = await request("GET", "/v1/jobs");
  assert.ok(Array.isArray(list.data), "jobs list should be an array");
  assert.ok(list.data.some((job) => job.id === created.data.id), "created job should be listed");

  const audit = await request("GET", "/v1/ops/audit");
  assert.ok(Array.isArray(audit.data), "audit list should be an array");
  assert.ok(
    audit.data.some((entry) => entry.entityId === created.data.id && entry.action === "job.create"),
    "audit should include created job"
  );

  console.log("[smoke:persistence] success", created.data.id);
}

async function request(method, path, body) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": config.tenantId,
      "x-user-id": config.userId,
      "x-org-id": config.orgId,
      "x-roles": config.roles
    },
    body: method === "GET" || body === undefined ? undefined : JSON.stringify(body)
  });

  const json = await response.json();
  assert.ok(response.ok, `[${method}] ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  return json;
}

main().catch((error) => {
  console.error("[smoke:persistence] failed", error);
  process.exit(1);
});
