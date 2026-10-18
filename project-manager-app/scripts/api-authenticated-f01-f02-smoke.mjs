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
      ...(body === undefined ? {} : { "content-type": "application/json" }),
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

  // A valid owner can turn a private lead into a synthetic estimate draft.
  // This creates only a DB invoice in the disposable CI environment;
  // no payment provider, funding or delivery to a customer is invoked.
  const estimate = await request("POST", "/v1/contractor/leads/" + leadId + "/create-estimate", {
    token: owner.token,
    body: {
      lineItems: [{ description: "TEST electrical work", qty: 1, unitPrice: 175, taxRate: 0, total: 175 }],
    },
  });
  assert.ok(estimate.data?.id, "estimate must be persisted as a draft invoice");
  const linked = await request("GET", "/v1/contractor/leads/" + leadId, { token: owner.token });
  assert.equal(linked.data.status, "estimate_sent");

  const owners = await request("GET", "/v1/contractor/leads", { token: owner.token });
  assert.ok(owners.data.find(l => l.id === leadId));
  const foreignList = await request("GET", "/v1/contractor/leads", { token: otherClient.token });
  assert.ok(!foreignList.data.find(l => l.id === leadId));
  console.log("[F02] authenticated private CRM isolation PASS", { leadId, realUserPilot: false });
}

/**
 * Prometeo P0 #974: exercise the real auth guard + HTTP controller + SQL
 * repository against the temporary Postgres16 service on localhost:4001.
 * Documents are DB fixtures because CLIENT/PRO cannot manage the library.
 * This must never be used against staging or production databases.
 */
async function prometeoObjectScopeSmoke() {
  const [owner, otherClient, pro1, , foreignClient] = persons;
  const ownerMarker = "PROMETEO_P0_OWNER_" + runId;
  const otherMarker = "PROMETEO_P0_OTHER_" + runId;
  const foreignMarker = "PROMETEO_P0_FOREIGN_" + runId;

  const sharedProject = await prisma.project.findFirst({
    where: { tenantId: tenantA, job: { clientOrgId: owner.orgId }, assignedProOrgId: pro1.orgId },
    select: { id: true },
  });
  assert.ok(sharedProject?.id, "F01 should create a project with an authorized client and pro");

  async function documentFor(actor, marker, projectId) {
    const doc = await prisma.prometeoDocument.create({
      data: {
        tenantId: actor.tenantId, orgId: actor.orgId,
        ...(projectId ? { projectId } : {}),
        title: marker, sourceType: "text", uploadedById: actor.userId,
        status: "indexed", chunkCount: 1,
        // Legacy labels have NO effect on authorization.
        metadataJson: { visibility: "public_training", trade: "electrical" },
      },
    });
    const chunk = await prisma.documentChunk.create({
      data: {
        tenantId: actor.tenantId, documentId: doc.id,
        chunkIndex: 0, text: marker + " electrical isolation test",
        tokenCount: 5, embeddingJson: [0, 0], metadataJson: { trade: "electrical" },
      },
    });
    return { doc, chunk };
  }

  const own = await documentFor(owner, ownerMarker);
  const ownerProject = await documentFor(owner, ownerMarker + "_PROJECT", sharedProject.id);
  const unrelated = await documentFor(otherClient, otherMarker);
  const foreign = await documentFor(foreignClient, foreignMarker);

  const documentIds = async actor => {
    const res = await request("GET", "/v1/prometeo/documents", { token: actor.token });
    assert.ok(Array.isArray(res.data), "Prometeo list must return an array");
    return new Set(res.data.map(d => d.id));
  };
  const ownerIds = await documentIds(owner);
  assert.ok(ownerIds.has(own.doc.id));
  assert.ok(ownerIds.has(ownerProject.doc.id));
  assert.ok(!ownerIds.has(unrelated.doc.id));
  assert.ok(!ownerIds.has(foreign.doc.id));

  const peerIds = await documentIds(otherClient);
  assert.ok(peerIds.has(unrelated.doc.id));
  assert.ok(!peerIds.has(own.doc.id));
  assert.ok(!peerIds.has(ownerProject.doc.id));

  const proIds = await documentIds(pro1);
  assert.ok(!proIds.has(ownerProject.doc.id),
    "Project membership alone cannot share a legacy document owned by another org");

  const otherTenantIds = await documentIds(foreignClient);
  assert.ok(otherTenantIds.has(foreign.doc.id));
  assert.ok(!otherTenantIds.has(own.doc.id));

  // Authorized project filtering is checked by the API before retrieval.
  await request("GET", "/v1/prometeo/documents?projectId=" + encodeURIComponent(sharedProject.id), {
    token: otherClient.token, expectedStatus: 403,
  });
  const proProjectView = await request("GET", "/v1/prometeo/documents?projectId=" + encodeURIComponent(sharedProject.id), {
    token: pro1.token,
  });
  assert.ok(!proProjectView.data.some(d => d.id === ownerProject.doc.id));

  const searchAs = async (actor, query) => request("POST", "/v1/prometeo/search", {
    token: actor.token, body: { query, topK: 20 },
  });
  const peerSearch = await searchAs(otherClient, ownerMarker);
  assert.ok(!peerSearch.data.some(chunk => chunk.documentId === own.doc.id || chunk.documentId === ownerProject.doc.id),
    "RAG search cannot return another org's chunk even for an exact secret query");
  const foreignSearch = await searchAs(foreignClient, ownerMarker);
  assert.ok(!foreignSearch.data.some(chunk => chunk.documentId === own.doc.id));

  const ctx = await request("POST", "/v1/prometeo/rag-context", {
    token: otherClient.token, body: { query: ownerMarker, topK: 20 },
  });
  assert.ok(!JSON.stringify(ctx.data).includes(ownerMarker),
    "RAG context must not reveal another org's marker, excerpts or citations");

  const denied = await request("POST", "/v1/prometeo/chunks/" + own.chunk.id + "/feedback", {
    token: otherClient.token, body: { type: "confirm" }, expectedStatus: 403,
  });
  assert.equal(denied.status, 403);
  await request("POST", "/v1/prometeo/chunks/" + own.chunk.id + "/feedback", {
    token: foreignClient.token, body: { type: "confirm" }, expectedStatus: 404,
  });
  const allowed = await request("POST", "/v1/prometeo/chunks/" + own.chunk.id + "/feedback", {
    token: owner.token, body: { type: "confirm" },
  });
  assert.equal(allowed.data?.recorded, true);

  const peerStats = await request("GET", "/v1/prometeo/feedback/stats", { token: otherClient.token });
  assert.ok(!peerStats.data?.topDocuments?.some(x => x.documentId === own.doc.id));

  // Authorization proof must come from the signed session, not forged headers.
  await request("GET", "/v1/prometeo/documents", {
    expectedStatus: 401,
    spoofedHeaders: { "x-user-id": owner.userId, "x-org-id": owner.orgId, "x-tenant-id": tenantA, "x-roles": "OPS_ADMIN" },
  });
  console.log("[PROMETEO P0] signed-session multi-org + RAG + feedback isolation PASS", {
    ownerDocumentCount: ownerIds.size, crossTenantBlocked: true, realUserPilot: false,
  });
}

async function revocation() {
  const owner = persons[0];
  await request("POST", "/v1/auth/logout", { token: owner.token, body: {} });
  await request("GET", "/v1/auth/me", { token: owner.token, expectedStatus: 401 });

  // Active sessions are re-authorized against current organization membership.
  const pro2 = persons[3];
  const revokedMembership = await prisma.membership.updateMany({
    where: { userId: pro2.userId, orgId: pro2.orgId, status: "ACTIVE" },
    data: { status: "SUSPENDED" },
  });
  assert.equal(revokedMembership.count, 1);
  await request("GET", "/v1/auth/me", { token: pro2.token, expectedStatus: 401 });
  console.log("[AUTH] revoked session and suspended membership rejected PASS");
}

async function main() {
  try {
    await seed();
    await loginAll();
    await f01();
    await f02();
    await prometeoObjectScopeSmoke();
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
