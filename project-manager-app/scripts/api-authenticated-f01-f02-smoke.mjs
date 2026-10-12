// F01/F02 integration: REAL signed login + persisted session + active membership
// via HTTP against a CI-only ephemeral PostgreSQL 16 service. Never production.
import assert from "node:assert/strict";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const base = new URL(process.env.SEMSE_API_URL ?? "http://127.0.0.1:4001");
const dbUrl = new URL(process.env.DATABASE_URL ?? "postgresql://invalid:invalid@invalid/invalid");
assert.equal(process.env.CI, "true", "Only GitHub CI is allowed");
assert.equal(process.env.SEMSE_AUTH_TEST_ONLY, "1", "Explicit isolated auth test opt-in required");
assert.equal(process.env.NODE_ENV, "test", "CI must start the auth test in NODE_ENV=test");
assert.equal(base.protocol, "http:");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname));
assert.equal(base.port, "4001", "Authenticated test API must use isolated port 4001");
assert.equal(dbUrl.hostname, "127.0.0.1");
assert.equal(dbUrl.port, "5433", "Authenticated test must not connect to production DB");
assert.equal(dbUrl.pathname, "/semse", "Unexpected DB name");

// A unique tenant/identity namespace is used per run. The runner destroys
// the temporary PostgreSQL container; NEVER run broad data-deletion scripts.
const runId = randomUUID().replaceAll("-", "").slice(0, 14);
const tenantA = "test_auth_tenant_a_" + runId;
const tenantB = "test_auth_tenant_b_" + runId;
const password = randomBytes(24).toString("base64url");
const prisma = new PrismaClient();
const persons = [
  { key: "owner", tenantId: tenantA, role: "CLIENT" },
  { key: "otherClient", tenantId: tenantA, role: "CLIENT" },
  { key: "pro1", tenantId: tenantA, role: "PRO" },
  { key: "pro2", tenantId: tenantA, role: "PRO" },
  { key: "foreignClient", tenantId: tenantB, role: "CLIENT" },
];
for (const p of persons) {
  p.userId = "test_auth_user_" + p.key + "_" + runId;
  p.orgId = "test_auth_org_" + p.key + "_" + runId;
  p.email = p.key.toLowerCase() + "." + runId + "@example.invalid";
}

async function request(method, route, { token, body, expectedStatus, spoofedHeaders } = {}) {
  const res = await fetch(new URL(route, base), {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: "Bearer " + token } : {}),
      ...(spoofedHeaders ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null);
  if (expectedStatus !== undefined) {
    assert.equal(res.status, expectedStatus, method + " " + route + " returned " + res.status);
  } else {
    assert.ok(res.ok, method + " " + route + " failed " + res.status + " " + JSON.stringify(payload));
  }
  return { status: res.status, data: payload?.data, payload };
}

async function seed() {
  for (const [id, key] of [[tenantA, "a"], [tenantB, "b"]]) {
    await prisma.tenant.create({ data: { id, slug: "test-auth-" + key + "-" + runId, name: "TEST AUTH " + key } });
  }
  for (const role of ["CLIENT", "PRO"]) {
    await prisma.role.upsert({ where: { key: role }, create: { key: role, name: role }, update: {} });
  }
  const hash = "s1$" + (() => {
    const salt = randomBytes(16);
    return salt.toString("base64url") + "$" + scryptSync(password, salt, 64).toString("base64url");
  })();
  for (const actor of persons) {
    await prisma.org.create({ data: { id: actor.orgId, tenantId: actor.tenantId, type: actor.role.toLowerCase(), name: "TEST AUTH " + actor.key } });
    await prisma.user.create({ data: { id: actor.userId, email: actor.email, status: "active", passwordHash: hash } });
    const role = await prisma.role.findUniqueOrThrow({ where: { key: actor.role }, select: { id: true } });
    await prisma.membership.create({
      data: { userId: actor.userId, orgId: actor.orgId, roleId: role.id, status: "ACTIVE" },
    });
  }
}

async function loginAll() {
  // Only five login calls, within the endpoint's 5-per-minute throttle.
  for (const actor of persons) {
    const response = await request("POST", "/v1/auth/login", {
      body: { email: actor.email, password },
    });
    actor.token = response.data?.accessToken;
    actor.sessionId = response.data?.sessionId;
    assert.ok(actor.token && actor.sessionId, "Login must create durable session: " + actor.key);
    const me = await request("GET", "/v1/auth/me", { token: actor.token });
    assert.equal(me.data?.orgId, actor.orgId);
    assert.equal(me.data?.tenantId, actor.tenantId);
    assert.ok(me.data?.roles?.includes(actor.role));
  }
}

async function f01() {
  const [owner, otherClient, pro1, pro2, foreignClient] = persons;

  // Header claims without bearer are ignored when AUTH_SECRET is enabled.
  await request("GET", "/v1/auth/me", {
    expectedStatus: 401,
    spoofedHeaders: {
      "x-user-id": owner.userId, "x-org-id": owner.orgId,
      "x-tenant-id": owner.tenantId, "x-roles": "OPS_ADMIN",
    },
  });
  await request("GET", "/v1/auth/me", { token: "not-a-signed-token", expectedStatus: 401 });

  const created = await request("POST", "/v1/jobs", {
    token: owner.token,
    body: {
      title: "TEST Authenticated F01 " + runId,
      scope: "A controlled isolated Marketplace bid and acceptance journey.",
      budgetMin: 950,
      budgetMax: 1750,
    },
  });
  const jobId = created.data?.id;
  assert.ok(jobId);
  assert.equal(created.data.status.toLowerCase(), "posted");

  const bids = [];
  for (const [actor, amount] of [[pro1, 1100], [pro2, 1400]]) {
    const r = await request("POST", "/v1/jobs/" + jobId + "/bids", {
      token: actor.token,
      body: { proOrgId: actor.orgId, amount, etaDays: 7 },
    });
    assert.ok(r.data?.id);
    bids.push(r.data);
  }
  const winnerId = bids[0].id;
  const loserId = bids[1].id;

  // Bid prices are not a tenant-wide public list.
  const ownerRead = await request("GET", "/v1/jobs/" + jobId + "/bids", { token: owner.token });
  assert.equal(ownerRead.data.length, 2);
  await request("GET", "/v1/jobs/" + jobId + "/bids", { token: otherClient.token, expectedStatus: 403 });
  await request("GET", "/v1/jobs/" + jobId + "/bids", { token: pro1.token, expectedStatus: 403 });
  await request("GET", "/v1/jobs/" + jobId + "/bids", { token: foreignClient.token, expectedStatus: 404 });

  await request("POST", "/v1/bids/" + winnerId + "/accept", { token: otherClient.token, body: {}, expectedStatus: 403 });
  await request("POST", "/v1/bids/" + winnerId + "/accept", { token: foreignClient.token, body: {}, expectedStatus: 404 });
  const result = await request("POST", "/v1/bids/" + winnerId + "/accept", { token: owner.token, body: {} });
  assert.equal(result.data.status.toLowerCase(), "accepted");

  const after = await request("GET", "/v1/jobs/" + jobId + "/bids", { token: owner.token });
  assert.equal(after.data.find(b => b.id === winnerId)?.status, "accepted");
  assert.equal(after.data.find(b => b.id === loserId)?.status, "rejected");
  const db = await prisma.project.findUnique({ where: { jobId }, select: { assignedProOrgId: true } });
  assert.equal(db?.assignedProOrgId, pro1.orgId);
  console.log("[F01] authenticated bid journey PASS", { jobId, realUserPilot: false });
}

async function f02() {
  const [owner, otherClient, , , foreignClient] = persons;
  const created = await request("POST", "/v1/contractor/leads", {
    token: owner.token,
    body: { name: "TEST Private Client " + runId, jobType: "electrical", source: "referral" },
  });
  const leadId = created.data?.id;
  assert.ok(leadId);
  assert.equal(created.data.orgId, owner.orgId);

  await request("GET", "/v1/contractor/leads/" + leadId, { token: otherClient.token, expectedStatus: 404 });
  await request("PATCH", "/v1/contractor/leads/" + leadId, {
    token: otherClient.token, body: { status: "completed" }, expectedStatus: 404,
  });
  await request("DELETE", "/v1/contractor/leads/" + leadId, { token: otherClient.token, expectedStatus: 404 });
  await request("POST", "/v1/contractor/leads/" + leadId + "/suggest-estimate", {
    token: otherClient.token, body: {}, expectedStatus: 404,
  });
  await request("POST", "/v1/contractor/leads/" + leadId + "/create-estimate", {
    token: otherClient.token, body: { lineItems: [] }, expectedStatus: 404,
  });
  await request("GET", "/v1/contractor/leads/" + leadId, { token: foreignClient.token, expectedStatus: 404 });

  const ownerRead = await request("GET", "/v1/contractor/leads/" + leadId, { token: owner.token });
  assert.equal(ownerRead.data?.status, "new");
  const updated = await request("PATCH", "/v1/contractor/leads/" + leadId, {
    token: owner.token, body: { status: "contacted" },
  });
  assert.equal(updated.data.status, "contacted");
  const owners = await request("GET", "/v1/contractor/leads", { token: owner.token });
  assert.ok(owners.data.find(l => l.id === leadId));
  const foreignList = await request("GET", "/v1/contractor/leads", { token: otherClient.token });
  assert.ok(!foreignList.data.find(l => l.id === leadId));
  console.log("[F02] authenticated private CRM isolation PASS", { leadId, realUserPilot: false });
}

async function revocation() {
  const owner = persons[0];
  await request("POST", "/v1/auth/logout", { token: owner.token, body: {} });
  await request("GET", "/v1/auth/me", { token: owner.token, expectedStatus: 401 });
  console.log("[AUTH] revoked session rejected PASS");
}

async function main() {
  try {
    await seed();
    await loginAll();
    await f01();
    await f02();
    await revocation();
    console.log("[AUTH F01+F02] all isolated authenticated flows PASS", {
      runId, realPayment: false, realPilot: false,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error("[AUTH F01+F02] failed", error);
  process.exitCode = 1;
});
