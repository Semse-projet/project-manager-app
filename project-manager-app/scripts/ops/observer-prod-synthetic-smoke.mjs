/**
 * PR #1089 observer isolation: one-shot production smoke with TWO synthetic
 * tenants and their OPS_ADMIN users. Read-only HTTP assertions after seeding;
 * fixture rows are removed in finally (or with --cleanup=RUNID after a crash).
 *
 * NEVER run automatically. Intended for an authorized, existing Railway API
 * environment with its production DATABASE_URL. No new Railway services.
 * No credentials/tokens/payloads are logged or stored on disk.
 */
import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";

const EXPECTED_PROJECT = "95ad1b14-d1d9-467d-82d8-5354619ba873";
const API = "https://api.semseproject.com";
const FLAG = "YES_OBSERVER_1089_SYNTHETIC_WRITE_AND_CLEANUP";
const CLEANUP_PREFIX = "--cleanup=";
const cleanupArgument = process.argv.find((part) => part.startsWith(CLEANUP_PREFIX));
const apply = process.argv.includes("--apply");

if (!apply) {
  console.log("PLAN ONLY: two disposable tenants, two OPS_ADMIN users, login, signed HTTP A/B smoke, exact-ID cleanup.");
  console.log("Requires Railway production API runtime, --apply and SEMSE_OBSERVER_SMOKE_ACK opt-in.");
  process.exit(0);
}

assert.equal(process.env.RAILWAY_PROJECT_ID, EXPECTED_PROJECT, "Wrong Railway project");
assert.equal(process.env.RAILWAY_ENVIRONMENT_NAME, "production", "Only designated production environment");
assert.equal(process.env.NODE_ENV, "production", "Production runtime required");
assert.equal(process.env.SEMSE_OBSERVER_SMOKE_ACK, FLAG, "Explicit one-shot write acknowledgement required");
assert.ok(process.env.DATABASE_URL, "Private DATABASE_URL must exist in the runtime");
assert.ok(!process.env.SEMSE_OBSERVER_SMOKE_EMAIL, "Do not reuse external accounts");
const apiUrl = new URL(process.env.SEMSE_API_URL ?? API);
assert.equal(apiUrl.origin, API, "Unexpected API origin");
assert.equal(apiUrl.pathname, "/", "Only API root is permitted");
assert.equal(apiUrl.username, "", "Embedded API credentials forbidden");
assert.equal(apiUrl.password, "", "Embedded API credentials forbidden");

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient({ log: ["error"] });

function ids(runId) {
  assert.match(runId, /^[a-f0-9]{16}$/, "Invalid exact run identifier");
  return ["a", "b"].map((key) => ({
    key,
    tenantId: "test_ohi14_t_" + key + "_" + runId,
    orgId: "test_ohi14_o_" + key + "_" + runId,
    userId: "test_ohi14_u_" + key + "_" + runId,
    email: "test-ohi14-" + key + "-" + runId + "@example.invalid",
    name: "SEMSE OBSERVER SMOKE " + key.toUpperCase() + " " + runId,
  }));
}

function passwordHash(password) {
  const salt = randomBytes(16);
  return "s1$" + salt.toString("base64url") + "$" +
    scryptSync(password, salt, 64).toString("base64url");
}

async function request(method, path, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), path.includes("/observer/latest") ? 90000 : 25000);
  try {
    const response = await fetch(new URL(path, apiUrl), {
      method,
      signal: controller.signal,
      headers: {
        ...(opts.body ? { "content-type": "application/json" } : {}),
        ...(opts.token ? { authorization: "Bearer " + opts.token } : {}),
        ...(opts.spoof ? { "x-tenant-id": opts.spoof, "x-org-id": "foreign-org" } : {}),
      },
      ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
    });
    // NEVER log the response body: it may contain private Observer metadata.
    const payload = await response.json().catch(() => null);
    return { status: response.status, data: payload?.data };
  } finally {
    clearTimeout(timer);
  }
}

async function prepare(runId, people) {
  const role = await prisma.role.findUnique({ where: { key: "OPS_ADMIN" }, select: { id: true } });
  assert.ok(role?.id, "Existing OPS_ADMIN role is required; do not seed global roles");
  const password = randomBytes(32).toString("base64url");
  const hash = passwordHash(password);
  await prisma.$transaction(async (tx) => {
    for (const p of people) {
      await tx.tenant.create({
        data: { id: p.tenantId, slug: p.tenantId, name: p.name, status: "active" },
      });
      await tx.org.create({
        data: { id: p.orgId, tenantId: p.tenantId, type: "ops", name: p.name },
      });
      await tx.user.create({
        data: {
          id: p.userId, email: p.email, passwordHash: hash,
          status: "active", verificationStatus: "unverified",
        },
      });
      await tx.userProfile.create({
        data: { userId: p.userId, displayName: p.name },
      });
      await tx.membership.create({
        data: { userId: p.userId, orgId: p.orgId, roleId: role.id, status: "ACTIVE" },
      });
    }
  });
  return password;
}

async function cleanup(runId) {
  const people = ids(runId);
  await prisma.$transaction(async (tx) => {
    // Exact IDs + names/emails are verified before deleting ANY rows.
    for (const p of people) {
      const [t, o, u] = await Promise.all([
        tx.tenant.findUnique({ where: { id: p.tenantId }, select: { name: true } }),
        tx.org.findUnique({ where: { id: p.orgId }, select: { tenantId: true, name: true } }),
        tx.user.findUnique({ where: { id: p.userId }, select: { email: true } }),
      ]);
      if (!t && !o && !u) continue; // already clean, safe retry
      assert.equal(t?.name, p.name, "Tenant marker mismatch; cleanup stopped");
      assert.equal(o?.tenantId, p.tenantId, "Org/tenant mismatch; cleanup stopped");
      assert.equal(o?.name, p.name, "Org name mismatch; cleanup stopped");
      assert.equal(u?.email, p.email, "User marker mismatch; cleanup stopped");
    }
    const userIds = people.map((p) => p.userId);
    for (const p of people) {
      const count = await tx.user.count({ where: { id: p.userId, email: p.email } });
      if (count === 0) continue;
      await tx.authSession.deleteMany({ where: { userId: p.userId, tenantId: p.tenantId } });
      await tx.membership.deleteMany({ where: { userId: p.userId, orgId: p.orgId } });
      await tx.userProfile.deleteMany({ where: { userId: p.userId } });
      await tx.user.delete({ where: { id: p.userId } });
    }
    for (const p of people) {
      await tx.org.deleteMany({ where: { id: p.orgId, tenantId: p.tenantId, name: p.name } });
      // Cascades only within the exact synthetic tenant, including its audit log.
      await tx.tenant.deleteMany({ where: { id: p.tenantId, name: p.name } });
    }
    assert.equal(userIds.length, 2);
  });
  console.log("CLEANUP PASS: exact synthetic tenant/org/user rows deleted for run " + runId);
}

async function smoke(people, password) {
  const sessions = [];
  for (const p of people) {
    const login = await request("POST", "/v1/auth/login", {
      body: { email: p.email, password },
    });
    assert.equal(login.status, 200, "Synthetic login must succeed");
    assert.ok(login.data?.accessToken, "Durable session access token required");
    p.token = login.data.accessToken; // in memory only
    sessions.push(p);
    const me = await request("GET", "/v1/auth/me", { token: p.token });
    assert.equal(me.status, 200, "Signed auth/me required");
    assert.equal(me.data?.tenantId, p.tenantId);
    assert.equal(me.data?.orgId, p.orgId);
    assert.ok(me.data?.roles?.includes("OPS_ADMIN"));
  }

  for (const p of people) {
    const other = people.find((x) => x.key !== p.key);
    const initial = await request("GET", "/v1/ops/observer/history", {
      token: p.token, spoof: other.tenantId,
    });
    assert.equal(initial.status, 200, "Auth history with spoofed header must pass");
    assert.equal(initial.data?.count, 0, "New synthetic tenant must have empty history");
    assert.deepEqual(initial.data?.snapshots, []);
  }

  for (const p of people) {
    const other = people.find((x) => x.key !== p.key);
    const latest = await request("GET", "/v1/ops/observer/latest", {
      token: p.token, spoof: other.tenantId,
    });
    assert.equal(latest.status, 200, "Latest must succeed, not cross-tenant or 503");
    assert.equal(latest.data?.tenantId, p.tenantId, "Cross-tenant latest exposure");
    const cached = await request("GET", "/v1/ops/observer/latest", {
      token: p.token, spoof: other.tenantId,
    });
    assert.equal(cached.status, 200);
    assert.equal(cached.data?.tenantId, p.tenantId);
    assert.equal(cached.data?.fromCache, true, "Second latest should use own cache");
    const history = await request("GET", "/v1/ops/observer/history", {
      token: p.token, spoof: other.tenantId,
    });
    assert.equal(history.status, 200);
    assert.ok(history.data?.count >= 1, "Own history must include latest");
    assert.ok(history.data?.count <= 50, "Retention cap must hold");
    assert.ok(history.data?.snapshots?.length <= 10, "HTTP pagination cap must hold");
  }

  for (const p of people) {
    const logout = await request("POST", "/v1/auth/logout", { token: p.token });
    assert.equal(logout.status, 200, "Synthetic logout must revoke session");
    const denied = await request("GET", "/v1/ops/observer/history", { token: p.token });
    assert.equal(denied.status, 401, "Revoked session must be rejected");
    p.token = undefined;
  }
  console.log("SMOKE PASS: two signed OPS_ADMIN tenants isolated; spoofed headers ignored; latest cached; revoked sessions rejected.");
}

const runId = cleanupArgument
  ? cleanupArgument.slice(CLEANUP_PREFIX.length)
  : randomBytes(8).toString("hex");
const people = ids(runId);
console.log("Observer smoke run " + runId + " (no secrets will be printed)");
let success = false;
try {
  if (cleanupArgument) {
    await cleanup(runId);
  } else {
    const password = await prepare(runId, people);
    console.log("FIXTURES CREATED: two synthetic tenants with separate OPS_ADMIN accounts");
    await smoke(people, password);
    success = true;
  }
} catch (error) {
  process.exitCode = 1;
  console.error("Observer smoke FAILED for run " + runId + " (details intentionally redacted)");
} finally {
  if (!cleanupArgument) {
    try {
      await cleanup(runId);
    } catch {
      process.exitCode = 1;
      console.error("CLEANUP FAILED: run --apply --cleanup=" + runId + " from the authorized Railway environment.");
    }
  }
  await prisma.$disconnect();
}
if (success) console.log("SMOKE AND CLEANUP COMPLETED; no test accounts retained.");
