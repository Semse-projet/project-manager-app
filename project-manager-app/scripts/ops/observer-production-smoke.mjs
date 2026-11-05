#!/usr/bin/env node
/**
 * SEMSE PR #1089 — One-shot production smoke for two isolated synthetic tenants.
 * Uses real AuthService login and PostgreSQL memberships, never header-only auth.
 * Creates 2 OPS_ADMIN and 1 CLIENT, validates Observer isolation, deletes fixtures.
 * NO API route, NO startup seed, NO hardcoded password or token.
 *
 * Default is dry-run. Execute only in the existing semse-API Railway container:
 * SEMSE_OBSERVER_SMOKE_ACK=PR1089_SYNTHETIC_ONLY node scripts/ops/observer-production-smoke.mjs --apply
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";

const PROJECT_ID = "95ad1b14-d1d9-467d-82d8-5354619ba873";
const API = "https://api.semseproject.com";
const args = process.argv.slice(2);
assert.ok(args.every((arg) => arg === "--apply"), "Only --apply is supported");
const apply = args.includes("--apply");
if (!apply) {
  console.log("DRY RUN: no accounts created; --apply is required");
  process.exit(0);
}
assert.equal(process.env.RAILWAY_PROJECT_ID, PROJECT_ID, "Wrong Railway project");
assert.equal(process.env.RAILWAY_ENVIRONMENT_NAME, "production", "Wrong environment");
assert.equal(process.env.NODE_ENV, "production", "Not production API runtime");
assert.equal(process.env.SEMSE_OBSERVER_SMOKE_ACK, "PR1089_SYNTHETIC_ONLY", "Missing explicit opt-in");
assert.equal(new URL(process.env.DATABASE_URL || "postgresql://none/none").hostname,
  "postgres.railway.internal", "Must use the private Railway database, not a public proxy");

// Production Dockerfile installs @prisma/client as a workspace dependency of
// packages/db, not necessarily as a root-level package for scripts/ops.
import { createRequire } from "node:module";
const dbRequire = createRequire(new URL("../../packages/db/package.json", import.meta.url));
const { PrismaClient } = dbRequire("@prisma/client");
const db = new PrismaClient();
const run = randomUUID().replaceAll("-", "").slice(0, 20);
const ns = "test_ob1089_" + run;
const actors = [
  { key: "a", role: "OPS_ADMIN", tenant: ns + "_ta", org: ns + "_oa", user: ns + "_ua" },
  { key: "b", role: "OPS_ADMIN", tenant: ns + "_tb", org: ns + "_ob", user: ns + "_ub" },
  { key: "client", role: "CLIENT", tenant: ns + "_ta", org: ns + "_oc", user: ns + "_uc" },
];
for (const a of actors) {
  a.email = "observer-smoke-" + a.key + "-" + run + "@example.invalid";
  a.password = randomBytes(32).toString("base64url");
}
const passwords = actors.map((a) => a.email);
const userIds = actors.map((a) => a.user);
const orgIds = actors.map((a) => a.org);
const tenantIds = [actors[0].tenant, actors[1].tenant];

function hash(password) {
  const salt = randomBytes(16);
  return "s1$" + salt.toString("base64url") + "$" + scryptSync(password, salt, 64).toString("base64url");
}
async function api(path, { method = "GET", token, body, forgedTenant } = {}) {
  const res = await fetch(API + path, {
    method,
    signal: AbortSignal.timeout(30000),
    headers: {
      ...(token ? { authorization: "Bearer " + token } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
      ...(forgedTenant ? { "x-tenant-id": forgedTenant } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  // Do not print raw responses: snapshots and auth envelopes contain private data.
  const parsed = await res.json().catch(() => null);
  return { status: res.status, data: parsed?.data };
}
async function seed() {
  const roleRows = await db.role.findMany({
    where: { key: { in: ["OPS_ADMIN", "CLIENT"] } }, select: { key: true, id: true },
  });
  const roleByKey = new Map(roleRows.map((r) => [r.key, r.id]));
  assert.ok(roleByKey.has("OPS_ADMIN") && roleByKey.has("CLIENT"), "Seeded roles not available");
  await db.$transaction(async (tx) => {
    for (const a of actors.slice(0, 2)) {
      await tx.tenant.create({ data: { id: a.tenant, slug: a.tenant,
        name: "Temporary Observer smoke " + a.key + " " + run, status: "active" } });
    }
    for (const a of actors) {
      await tx.org.create({ data: { id: a.org, tenantId: a.tenant,
        type: "smoke-test", name: "Temporary Observer smoke " + a.key } });
      await tx.user.create({ data: { id: a.user, email: a.email, passwordHash: hash(a.password),
        status: "active", verificationStatus: "unverified" } });
      await tx.membership.create({ data: { userId: a.user, orgId: a.org,
        roleId: roleByKey.get(a.role), status: "ACTIVE" } });
      await tx.userProfile.create({ data: { userId: a.user, displayName: "Observer smoke " + a.key } });
    }
  }, { timeout: 20000 });
}
async function cleanup() {
  await db.$transaction(async (tx) => {
    // Restrict every mutation to exact random fixture identifiers.
    await tx.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await tx.membership.deleteMany({ where: { userId: { in: userIds }, orgId: { in: orgIds } } });
    await tx.userProfile.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds }, email: { in: passwords } } });
    await tx.org.deleteMany({ where: { id: { in: orgIds }, tenantId: { in: tenantIds } } });
    await tx.tenant.deleteMany({ where: { id: { in: tenantIds }, slug: { in: tenantIds } } });
  }, { timeout: 20000 });
  assert.equal(await db.tenant.count({ where: { id: { in: tenantIds } } }), 0,
    "Synthetic tenants survived cleanup");
}
async function smoke() {
  const [a, b, client] = actors;
  for (const actor of actors) {
    const login = await api("/v1/auth/login", {
      method: "POST", body: { email: actor.email, password: actor.password },
    });
    assert.equal(login.status, 201, "Signed login failed for " + actor.key);
    assert.ok(typeof login.data?.accessToken === "string", "No signed token");
    actor.token = login.data.accessToken;
    const me = await api("/v1/auth/me", { token: actor.token });
    assert.equal(me.status, 200);
    assert.equal(me.data?.tenantId, actor.tenant);
    assert.equal(me.data?.orgId, actor.org);
    assert.ok(me.data?.roles?.includes(actor.role));
  }
  assert.notEqual(a.tenant, b.tenant);
  for (const actor of [a, b]) {
    const empty = await api("/v1/ops/observer/history", { token: actor.token });
    assert.equal(empty.status, 200);
    assert.equal(empty.data?.count, 0, "Fresh synthetic tenant not empty");
    const snap = await api("/v1/ops/observer/snapshot", { token: actor.token });
    assert.equal(snap.status, 200);
    assert.equal(snap.data?.tenantId, actor.tenant);
    actor.observedAt = snap.data?.observedAt;
    assert.ok(actor.observedAt);
  }
  for (const [actor, foreign] of [[a, b], [b, a]]) {
    const history = await api("/v1/ops/observer/history", {
      token: actor.token, forgedTenant: foreign.tenant,
    });
    assert.equal(history.status, 200);
    assert.equal(history.data?.count, 1);
    assert.equal(history.data?.snapshots?.[0]?.observedAt, actor.observedAt,
      "Wrong tenant history or inconsistent instance");
    assert.notEqual(history.data?.snapshots?.[0]?.observedAt, foreign.observedAt);
    const latest = await api("/v1/ops/observer/latest", {
      token: actor.token, forgedTenant: foreign.tenant,
    });
    assert.equal(latest.status, 200);
    assert.equal(latest.data?.tenantId, actor.tenant);
    assert.equal(latest.data?.observedAt, actor.observedAt);
    assert.equal(latest.data?.fromCache, true);
  }
  assert.equal((await api("/v1/ops/observer/history", {
    token: client.token, forgedTenant: b.tenant,
  })).status, 403);
  assert.equal((await api("/v1/ops/observer/latest", {
    token: "not-a-valid-signed-token",
  })).status, 401);
  return { tenants: 2, accounts: 3, history: 2, latest: 2, negativeAuth: 2 };
}
let seeded = false;
try {
  console.log("Observer production smoke synthetic run:", run);
  await seed();
  seeded = true;
  const result = await smoke();
  console.log("OBSERVER PRODUCTION SMOKE PASS", JSON.stringify(result));
} catch (err) {
  console.error("OBSERVER PRODUCTION SMOKE FAIL:", err instanceof Error ? err.message : "unknown");
  process.exitCode = 1;
} finally {
  try {
    if (seeded) {
      await cleanup();
      console.log("Synthetic accounts and tenants deleted:", run);
    }
  } catch (err) {
    console.error("CRITICAL synthetic cleanup failed. Fixture run:", run,
      err instanceof Error ? err.message : "unknown");
    process.exitCode = 2;
  }
  await db.$disconnect();
}
