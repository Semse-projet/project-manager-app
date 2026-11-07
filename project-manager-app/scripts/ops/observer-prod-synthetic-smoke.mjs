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
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { createRequire } from "node:module";
import { assertEmptyObserverHistory, assertOwnObserverHistory } from "./observer-smoke-history-assertions.mjs";

const EXPECTED_PROJECT = "95ad1b14-d1d9-467d-82d8-5354619ba873";
const EXPECTED_API_SERVICE = "2bd1bd3f-9aa1-4fc3-a714-4cf90c52c770";
const EXPECTED_ENVIRONMENT = "d682210a-956a-4508-9c5b-4ca5959278f9";
const API = "https://api.semseproject.com";
const FLAG = "YES_OBSERVER_1089_SYNTHETIC_WRITE_AND_CLEANUP";
const CLEANUP_PREFIX = "--cleanup=";
const cleanupArgument = process.argv.find((part) => part.startsWith(CLEANUP_PREFIX));
const apply = process.argv.includes("--apply");

if (!apply) {
  console.log("PLAN ONLY: two disposable tenants, two OPS_ADMIN users, login, signed HTTP A/B smoke, exact-ID cleanup.");
  console.log("Requires Railway production API runtime, --apply, SEMSE_OBSERVER_SMOKE_EXPECTED_SHA and SEMSE_OBSERVER_SMOKE_ACK.");
  process.exit(0);
}

assert.equal(process.env.RAILWAY_PROJECT_ID, EXPECTED_PROJECT, "Wrong Railway project");
assert.equal(process.env.RAILWAY_ENVIRONMENT_NAME, "production", "Only designated production environment");
assert.equal(process.env.RAILWAY_ENVIRONMENT_ID, EXPECTED_ENVIRONMENT, "Wrong Railway environment ID");
assert.equal(process.env.RAILWAY_SERVICE_ID, EXPECTED_API_SERVICE, "Only the existing semse-API service may run this");
assert.notEqual(process.env.CI, "true", "Forbidden in CI: production smoke runs only from the Railway API console");
assert.equal(process.env.NODE_ENV, "production", "Production runtime required");
assert.equal(process.env.SEMSE_OBSERVER_SMOKE_ACK, FLAG, "Explicit one-shot write acknowledgement required");
assert.ok(process.env.DATABASE_URL, "Private DATABASE_URL must exist in the runtime");
const databaseUrl = new URL(process.env.DATABASE_URL);
assert.ok(["postgresql:", "postgres:"].includes(databaseUrl.protocol), "Unexpected database URL protocol");
assert.ok(databaseUrl.hostname.endsWith(".railway.internal"),
  "Production smoke requires private Railway PostgreSQL, not a public or external host");
assert.ok(!process.env.SEMSE_OBSERVER_SMOKE_EMAIL, "Do not reuse external accounts");
const apiUrl = new URL(API);
assert.equal(apiUrl.origin, API, "Unexpected API origin");
assert.equal(apiUrl.pathname, "/", "Only API root is permitted");
assert.equal(apiUrl.username, "", "Embedded API credentials forbidden");
assert.equal(apiUrl.password, "", "Embedded API credentials forbidden");

const EXPECTED_API_SHA = process.env.SEMSE_OBSERVER_SMOKE_EXPECTED_SHA;
// Both normal execution and emergency cleanup mutate production data.
// Neither path is authorized without attesting the current API build.
assert.match(EXPECTED_API_SHA ?? "", /^[a-f0-9]{40}$/, "Expected current production git SHA required");
// pnpm production installs isolate workspace dependencies: @prisma/client is
// linked beneath packages/db, not necessarily at the app root.
let PrismaClient;
try {
  ({ PrismaClient } = createRequire(new URL("../../packages/db/package.json", import.meta.url))("@prisma/client"));
} catch {
  ({ PrismaClient } = await import("@prisma/client"));
}
const prisma = new PrismaClient(); // do not log potentially identifying Prisma query details

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
        ...(opts.spoof ? { "x-tenant-id": opts.spoof } : {}),
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

async function preflight({ cleanupOnly = false } = {}) {
  // Fail before any database write if traffic is not routed to the intended
  // production build, or if required dependencies are not ready.
  const health = await request("GET", "/v1/health");
  assert.equal(health.status, 200, "API health must pass");
  assert.equal(health.data?.gitSha, EXPECTED_API_SHA, "Wrong production API build");
  assert.equal(health.data?.environment, "production", "Not the production API");
  if (!cleanupOnly) {
    const ready = await request("GET", "/v1/ready");
    assert.equal(ready.status, 200, "API readiness must pass");
    assert.equal(ready.data?.status, "ready", "API dependencies are not ready");
  }
  // Recovery must still function during degraded readiness (e.g., Redis down).
  // A live health endpoint with the exact production SHA remains mandatory.
  console.log(cleanupOnly
    ? "RECOVERY PREFLIGHT PASS: exact API SHA and production environment."
    : "PREFLIGHT PASS: health/ready 200, exact API SHA and production environment.");
}

async function prepare(runId, people) {
  // The lock protects the capacity check AND both inserts across all API
  // workers / operators sharing the production database. A plain count then
  // transaction permits two simultaneous invocations to both see zero.
  const password = randomBytes(32).toString("base64url");
  const hash = passwordHash(password);
  await prisma.$transaction(async (tx) => {
    const lock = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(48110891401::bigint) AS acquired`;
    assert.equal(lock[0]?.acquired, true, "Another synthetic Observer smoke is already preparing fixtures");
    // 48h from last tenant mutation is conservative relative to 24h idle TTL,
    // including cleanup time. Still not a proof of eviction if an unrelated
    // operator is manually reading the synthetic tenant from another session.
    const recentRuns = await tx.tenant.count({
      where: {
        id: { startsWith: "test_ohi14_t_" },
        OR: [
          { status: { not: "archived" } },
          { updatedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
        ],
      },
    });
    assert.equal(recentRuns, 0,
      "Another synthetic smoke is active or its 48-hour cache cooldown has not elapsed");
    const role = await tx.role.findUnique({ where: { key: "OPS_ADMIN" }, select: { id: true } });
    assert.ok(role?.id, "Existing OPS_ADMIN role is required; do not seed global roles");
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
      // Operator tooling, no human actor: do not invent an actorUserId.
      await tx.auditLog.create({
        data: {
          id: "aud_observer_provisioned_" + randomUUID().replaceAll("-", ""),
          tenantId: p.tenantId, actorUserId: null,
          entityType: "User", entityId: p.userId,
          action: "observer.synthetic_account.provisioned",
          afterJson: { purpose: "PR1089_AB_SMOKE", accountKey: p.key, role: "OPS_ADMIN", orgId: p.orgId },
        },
      });
    }
  });
  return password;
}

async function cleanup(runId) {
  const people = ids(runId);
  let markersVerified = false;
  try {
    await prisma.$transaction(async (tx) => {
      // Check exact synthetic IDs and markers before touching ANY record.
      // A partially completed cleanup may lack users/orgs but retain tenant
      // shells with their durable audit events. That is an allowed retry state.
      for (const p of people) {
        const [t, o, u] = await Promise.all([
          tx.tenant.findUnique({ where: { id: p.tenantId }, select: { name: true } }),
          tx.org.findUnique({ where: { id: p.orgId }, select: { tenantId: true, name: true } }),
          tx.user.findUnique({ where: { id: p.userId }, select: { email: true } }),
        ]);
        assert.ok(t, "Audit-retaining tenant shell is missing; cleanup cannot be certified");
        assert.equal(t.name, p.name, "Tenant marker mismatch; cleanup stopped");
        if (o) {
          assert.equal(o.tenantId, p.tenantId, "Org/tenant mismatch; cleanup stopped");
          assert.equal(o.name, p.name, "Org name mismatch; cleanup stopped");
        }
        if (u) assert.equal(u.email, p.email, "User marker mismatch; cleanup stopped");
      }
      markersVerified = true;
      for (const p of people) {
        // Same transaction as the teardown; the archived tenant keeps it.
        const tenant = await tx.tenant.findUnique({ where: { id: p.tenantId }, select: { status: true } });
        if (tenant && tenant.status !== "archived") {
          await tx.auditLog.create({
            data: {
              id: "aud_observer_removed_" + randomUUID().replaceAll("-", ""),
              tenantId: p.tenantId, actorUserId: null,
              entityType: "Tenant", entityId: p.tenantId,
              action: "observer.synthetic_account.removed",
              afterJson: { purpose: "PR1089_AB_SMOKE", accountKey: p.key, userId: p.userId,
                sessions: "deleted", tenantStatus: "archived" },
            },
          });
        }
      }
      for (const p of people) {
        await tx.authSession.deleteMany({ where: { userId: p.userId, tenantId: p.tenantId } });
        await tx.membership.deleteMany({ where: { userId: p.userId, orgId: p.orgId } });
        await tx.userProfile.deleteMany({ where: { userId: p.userId } });
        await tx.user.deleteMany({ where: { id: p.userId, email: p.email } });
        await tx.org.deleteMany({ where: { id: p.orgId, tenantId: p.tenantId, name: p.name } });
        // Do NOT delete Tenant: its AuditLog relation has ON DELETE CASCADE.
        // Keep the audit trail in an archived, memberless synthetic tenant.
        await tx.tenant.updateMany({
          where: { id: p.tenantId, name: p.name },
          data: { status: "archived" },
        });
      }
      for (const p of people) {
        assert.equal(await tx.user.count({ where: { id: p.userId } }), 0);
        assert.equal(await tx.org.count({ where: { id: p.orgId } }), 0);
        assert.equal(await tx.authSession.count({ where: { userId: p.userId, tenantId: p.tenantId } }), 0);
        const tenant = await tx.tenant.findUnique({ where: { id: p.tenantId }, select: { status: true } });
        if (tenant) assert.equal(tenant.status, "archived");
      }
    });
  } catch (error) {
    // Markers not verified: nothing here is provably ours, so touch nothing.
    if (!markersVerified) throw error;
    // The atomic teardown failed after the fixture was identified. Security
    // first: cut access even without the audit row, then record an incident
    // event if AuditLog is reachable. This path never reports PASS.
    const failed = [];
    const attempt = async (stage, fn) => { try { await fn(); } catch { failed.push(stage); } };
    const userIds = people.map((p) => p.userId);
    await attempt("sessions", () => prisma.authSession.deleteMany({ where: { userId: { in: userIds } } }));
    await attempt("memberships", () => prisma.membership.updateMany({
      where: { userId: { in: userIds } }, data: { status: "SUSPENDED" },
    }));
    await attempt("users", () => prisma.user.updateMany({
      where: { id: { in: userIds } }, data: { status: "suspended" },
    }));
    await attempt("incident-audit", () => prisma.$transaction(async (tx) => {
      for (const p of people) {
        if (!(await tx.tenant.findUnique({ where: { id: p.tenantId }, select: { id: true } }))) continue;
        await tx.auditLog.create({
          data: {
            id: "aud_observer_fallback_" + randomUUID().replaceAll("-", ""),
            tenantId: p.tenantId, actorUserId: null,
            entityType: "Tenant", entityId: p.tenantId,
            action: "observer.synthetic_cleanup.emergency_fallback",
            afterJson: { purpose: "PR1089_AB_SMOKE", accountKey: p.key, failedStages: failed,
              requiresOperatorRecovery: true },
          },
        });
      }
    }));
    console.error("CRITICAL OBSERVER_SYNTHETIC_CLEANUP_FALLBACK run " + runId +
      " failed stages: " + (failed.join(",") || "none") + "; rerun --apply --cleanup=" + runId);
    throw new Error("Atomic synthetic cleanup failed; emergency revocation attempted", { cause: error });
  }
  // Assert the committed state, not just the transaction's intent.
  for (const p of people) {
    assert.equal(await prisma.authSession.count({ where: { userId: p.userId } }), 0,
      "Synthetic sessions must be gone after cleanup");
    assert.equal(await prisma.user.count({ where: { id: p.userId } }), 0,
      "Synthetic users must be gone after cleanup");
    assert.equal(await prisma.membership.count({ where: { userId: p.userId, status: "ACTIVE" } }), 0,
      "No active synthetic membership may remain");
  }
  console.log("CLEANUP PASS: temporary users, orgs and sessions removed; audit-only tenant shells archived for run " + runId);
}
async function verifyAuthAudit(people) {
  // Session issuance records its audit event fire-and-forget; it may arrive
  // after login has returned. Bounded polling protects the claim that the
  // archived audit-only tenant actually retains both auth events.
  for (const p of people) {
    let witnessed = new Set();
    for (let attempt = 0; attempt < 8; attempt++) {
      const rows = await prisma.auditLog.findMany({
        where: { tenantId: p.tenantId,
          action: { in: ["auth.session.issued", "auth.session.revoked"] } },
        select: { action: true },
      });
      witnessed = new Set(rows.map((row) => row.action));
      if (witnessed.has("auth.session.issued") && witnessed.has("auth.session.revoked")) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(witnessed.has("auth.session.issued") && witnessed.has("auth.session.revoked"),
      "Synthetic auth audit events missing; abort PASS and retain archived audit shell");
  }
  console.log("AUDIT PASS: issued/revoked auth events durable for both synthetic tenants.");
}

async function smoke(people, password) {
  for (const p of people) {
    const login = await request("POST", "/v1/auth/login", {
      body: { email: p.email, password },
    });
    assert.ok([200, 201].includes(login.status), "Synthetic login must succeed");
    assert.ok(login.data?.accessToken, "Durable session access token required");
    p.token = login.data.accessToken; // in memory only
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
    assertEmptyObserverHistory(initial);
  }

  // Interleave A/B reads: B must remain empty immediately after A creates a
  // snapshot; after B observes, A must still contain only A's snapshot.
  // Checking cardinality at the end alone misses cross-tenant history leaks.
  const observedAtByTenant = new Map();
  for (const p of people) {
    const other = people.find((x) => x.key !== p.key);
    const latest = await request("GET", "/v1/ops/observer/latest", {
      token: p.token, spoof: other.tenantId,
    });
    assert.equal(latest.status, 200, "Latest must succeed, not cross-tenant or 503");
    assert.equal(latest.data?.tenantId, p.tenantId, "Cross-tenant latest exposure");
    assert.ok(typeof latest.data?.observedAt === "string",
      "Latest observation must carry an immutable timestamp");
    observedAtByTenant.set(p.key, latest.data.observedAt);
    const cached = await request("GET", "/v1/ops/observer/latest", {
      token: p.token, spoof: other.tenantId,
    });
    assert.equal(cached.status, 200);
    assert.equal(cached.data?.tenantId, p.tenantId);
    assert.equal(cached.data?.fromCache, true, "Second latest should use own cache");
    const history = await request("GET", "/v1/ops/observer/history", {
      token: p.token, spoof: other.tenantId,
    });
    assertOwnObserverHistory(history, observedAtByTenant.get(p.key));
    const otherHistory = await request("GET", "/v1/ops/observer/history", {
      token: other.token, spoof: p.tenantId,
    });
    if (observedAtByTenant.has(other.key)) {
      assertOwnObserverHistory(otherHistory, observedAtByTenant.get(other.key));
    } else {
      assertEmptyObserverHistory(otherHistory);
    }
  }

  for (const p of people) {
    const logout = await request("POST", "/v1/auth/logout", { token: p.token });
    assert.ok([200, 201].includes(logout.status), "Synthetic logout must revoke session");
    const denied = await request("GET", "/v1/ops/observer/history", { token: p.token });
    assert.equal(denied.status, 401, "Revoked session must be rejected");
    p.token = undefined;
    const other = people.find((x) => x.key !== p.key);
    if (other.token) {
      const still = await request("GET", "/v1/ops/observer/history", { token: other.token });
      assert.equal(still.status, 200, "Revoking one tenant's session must not affect the other");
    }
  }
  console.log("SMOKE PASS: two signed OPS_ADMIN tenants isolated; spoofed headers ignored; latest cached; revoked sessions rejected.");
}

const runId = cleanupArgument
  ? cleanupArgument.slice(CLEANUP_PREFIX.length)
  : randomBytes(8).toString("hex");
const people = ids(runId);
console.log("Observer smoke run " + runId + " (no secrets will be printed)");
let success = false;
let fixturesCreated = false;
try {
  if (cleanupArgument) {
    await preflight({ cleanupOnly: true });
    await cleanup(runId);
  } else {
    await preflight();
    const password = await prepare(runId, people);
    fixturesCreated = true;
    console.log("FIXTURES CREATED: two synthetic tenants with separate OPS_ADMIN accounts");
    await smoke(people, password);
    await verifyAuthAudit(people);
    success = true;
  }
} catch (error) {
  process.exitCode = 1;
  console.error("Observer smoke FAILED for run " + runId + " (details intentionally redacted)");
} finally {
  if (!cleanupArgument && fixturesCreated) {
    try {
      await cleanup(runId);
    } catch {
      success = false;
      process.exitCode = 1;
      console.error("CLEANUP FAILED: run --apply --cleanup=" + runId + " from the authorized Railway environment.");
    }
  }
  await prisma.$disconnect();
}
if (success) console.log("SMOKE AND CLEANUP COMPLETED; no test accounts retained.");
