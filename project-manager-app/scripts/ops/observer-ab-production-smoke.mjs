/**
 * PR #1089: controlled one-shot PRODUCTION smoke with exactly two synthetic
 * tenant-local OPS_ADMIN identities. NEVER executed at API startup.
 *
 * No real customer records, no schema changes, no shared tenant_default.
 * Requires an authorized Railway API console with a private Postgres URL.
 * The --run path suspends both accounts and revokes sessions in finally.
 * --revoke RUN_ID recovers identities if a process is interrupted.
 *
 * Run ONLY by an authorized operator inside existing semse-API container:
 *   SEMSE_OBSERVER_AB_APPROVAL=EXPLICIT_PRODUCTION_AB_SMOKE \
 *     node scripts/ops/observer-ab-production-smoke.mjs --run
 * Recovery (using the printed 12-character hex run ID):
 *   SEMSE_OBSERVER_AB_APPROVAL=EXPLICIT_PRODUCTION_AB_SMOKE \
 *     node scripts/ops/observer-ab-production-smoke.mjs --revoke <runId>
 */
import assert from "node:assert/strict";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";

const PROJECT = "95ad1b14-d1d9-467d-82d8-5354619ba873";
const ENV = "d682210a-956a-4508-9c5b-4ca5959278f9";
const SERVICE = "2bd1bd3f-9aa1-4fc3-a714-4cf90c52c770";
const EXPECTED_RELEASE_SHA = process.env.RAILWAY_GIT_COMMIT_SHA?.trim();
const API = "https://api.semseproject.com";
const PREFIX = "test_observer_ab_";
const arg = process.argv[2] ?? "--plan";
const runId = arg === "--revoke" ? process.argv[3] : randomUUID().replaceAll("-", "").slice(0, 12);

function identities(suffix) {
  assert.match(suffix, /^[a-f0-9]{12}$/, "Run ID must be 12 lowercase hex characters");
  return ["a", "b"].map(key => ({
    key,
    tenantId: PREFIX + "tenant_" + key + "_" + suffix,
    orgId: PREFIX + "org_" + key + "_" + suffix,
    userId: PREFIX + "user_" + key + "_" + suffix,
    email: "observer-ab-" + key + "-" + suffix + "@example.invalid",
  }));
}

function requireProductionAuthority() {
  assert.notEqual(process.env.CI, "true", "Forbidden in CI; use O.HI13 instead");
  assert.equal(process.env.NODE_ENV, "production", "Must execute in production API runtime");
  assert.equal(process.env.RAILWAY_PROJECT_ID, PROJECT, "Unexpected Railway project");
  assert.equal(process.env.RAILWAY_ENVIRONMENT_ID, ENV, "Unexpected Railway environment");
  assert.equal(process.env.RAILWAY_SERVICE_ID, SERVICE, "Must execute from existing semse-API");
  assert.equal(process.env.SEMSE_OBSERVER_AB_APPROVAL, "EXPLICIT_PRODUCTION_AB_SMOKE",
    "Explicit, invocation-scoped operator approval required");
  const db = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(db.protocol, "postgresql:", "PostgreSQL required");
  assert.ok(db.hostname.endsWith(".railway.internal"),
    "Refuse public/remote/CI databases: run inside existing Railway network");
}

async function jsonRequest(path, { token, forgedTenant, expected = 200, method = "GET", body } = {}) {
  const response = await fetch(API + path, {
    method,
    headers: {
      ...(token ? { authorization: "Bearer " + token } : {}),
      ...(forgedTenant ? { "x-tenant-id": forgedTenant } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(45_000),
  });
  // Never include response bodies in errors/logs: responses may contain
  // private operational metadata or bearer tokens.
  assert.equal(response.status, expected, path + ": expected HTTP " + expected +
    ", received " + response.status);
  return expected === 401 || expected === 403 ? null : (await response.json()).data;
}

async function assertRelease() {
  const health = await jsonRequest("/v1/health");
  assert.equal(health.status, "ok");
  assert.match(EXPECTED_RELEASE_SHA ?? "", /^[a-f0-9]{40}$/, "Railway deployment SHA required");
  assert.equal(health.gitSha, EXPECTED_RELEASE_SHA, "Wrong production release; abort before seeding");
  assert.equal(health.environment, "production");
}

async function disableSyntheticAccounts(prisma, actors) {
  // Verify ownership before changing any identity. Never use a broad tenant
  // cleanup or delete audit logs (which are intentionally retained).
  for (const a of actors) {
    const user = await prisma.user.findUnique({
      where: { id: a.userId }, select: { email: true },
    });
    if (user) assert.equal(user.email, a.email, "Unexpected user ID collision");
    const tenant = await prisma.tenant.findUnique({
      where: { id: a.tenantId }, select: { name: true },
    });
    if (tenant) assert.equal(tenant.name, "SEMSE Observer synthetic " + a.key.toUpperCase(),
      "Unexpected tenant ID collision");
  }
  const ids = actors.map(a => a.userId);
  await prisma.authSession.updateMany({
    where: { userId: { in: ids }, status: "ACTIVE" },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  await prisma.membership.updateMany({
    where: { userId: { in: ids } },
    data: { status: "SUSPENDED" },
  });
  await prisma.user.updateMany({
    where: { id: { in: ids } },
    data: { status: "suspended" },
  });
  await prisma.tenant.updateMany({
    where: { id: { in: actors.map(a => a.tenantId) } },
    data: { status: "suspended" },
  });
  const active = await prisma.authSession.count({
    where: { userId: { in: ids }, status: "ACTIVE" },
  });
  assert.equal(active, 0, "Active synthetic sessions must be zero after cleanup");
  assert.equal(await prisma.membership.count({
    where: { userId: { in: ids }, status: "ACTIVE" },
  }), 0, "Active synthetic memberships must be zero after cleanup");
  assert.equal(await prisma.user.count({
    where: { id: { in: ids }, status: "active" },
  }), 0, "Active synthetic users must be zero after cleanup");
}

async function seed(prisma, actors) {
  const role = await prisma.role.findUnique({ where: { key: "OPS_ADMIN" } });
  assert.ok(role, "OPS_ADMIN role not configured; do not create an elevated role");
  for (const a of actors) {
    a.password = randomBytes(32).toString("base64url");
    const salt = randomBytes(16);
    a.passwordHash = "s1$" + salt.toString("base64url") + "$" +
      scryptSync(a.password, salt, 64).toString("base64url");
  }
  await prisma.$transaction(async tx => {
    for (const a of actors) {
      await tx.tenant.create({ data: {
        id: a.tenantId, slug: a.tenantId,
        name: "SEMSE Observer synthetic " + a.key.toUpperCase(), status: "active",
      } });
      await tx.org.create({ data: {
        id: a.orgId, tenantId: a.tenantId, type: "ops",
        name: "SEMSE Observer synthetic org " + a.key.toUpperCase(),
      } });
      await tx.user.create({ data: {
        id: a.userId, email: a.email, passwordHash: a.passwordHash, status: "active",
        verificationStatus: "unverified",
      } });
      await tx.membership.create({ data: {
        userId: a.userId, orgId: a.orgId, roleId: role.id, status: "ACTIVE",
      } });
    }
  });
}

async function verify(prisma, actors) {
  const tokens = [];
  try {
    for (const a of actors) {
      const login = await jsonRequest("/v1/auth/login", {
        method: "POST", body: { email: a.email, password: a.password },
      });
      assert.ok(login?.accessToken, "Login did not issue a signed session");
      tokens.push(login.accessToken);
      const me = await jsonRequest("/v1/auth/me", { token: login.accessToken });
      assert.equal(me.tenantId, a.tenantId);
      assert.equal(me.orgId, a.orgId);
      assert.ok(me.roles.includes("OPS_ADMIN"));
    }
    await jsonRequest("/v1/ops/observer/history", { expected: 401 });
    await jsonRequest("/v1/ops/observer/latest", { expected: 401 });

    const [a, b] = actors;
    const [tokenA, tokenB] = tokens;
    // At most one cache miss/observation for each synthetic tenant.
    const latestA = await jsonRequest("/v1/ops/observer/latest", {
      token: tokenA, forgedTenant: b.tenantId,
    });
    assert.equal(latestA.tenantId, a.tenantId, "A latest exposed wrong tenant");
    await new Promise(resolve => setTimeout(resolve, 80));
    const latestB = await jsonRequest("/v1/ops/observer/latest", {
      token: tokenB, forgedTenant: a.tenantId,
    });
    assert.equal(latestB.tenantId, b.tenantId, "B latest exposed wrong tenant");

    const historyA = await jsonRequest("/v1/ops/observer/history", {
      token: tokenA, forgedTenant: b.tenantId,
    });
    const historyB = await jsonRequest("/v1/ops/observer/history", {
      token: tokenB, forgedTenant: a.tenantId,
    });
    assert.ok(historyA.count >= 1 && historyB.count >= 1,
      "In-memory history not visible; check replica routing before claiming PASS");
    const marksA = historyA.snapshots.map(s => s.observedAt);
    const marksB = historyB.snapshots.map(s => s.observedAt);
    assert.ok(marksA.includes(latestA.observedAt));
    assert.ok(marksB.includes(latestB.observedAt));
    if (latestA.observedAt !== latestB.observedAt) {
      assert.ok(!marksA.includes(latestB.observedAt), "A can see B's timestamp");
      assert.ok(!marksB.includes(latestA.observedAt), "B can see A's timestamp");
    }
    // Force expiry of A's synthetic session and verify durable revocation.
    await prisma.authSession.updateMany({
      where: { userId: a.userId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    await jsonRequest("/v1/ops/observer/history", { token: tokenA, expected: 401 });
    await jsonRequest("/v1/ops/observer/history", { token: tokenB });
    return {
      release: EXPECTED_RELEASE_SHA.slice(0, 12), checked: [
        "signed-login-A-B", "tenant-A-B-distinct", "anonymous-401",
        "latest-A-B", "history-A-B", "forged-tenant-header", "revoked-session-401",
      ],
    };
  } finally {
    // Bearer secrets are NEVER logged, returned, saved or uploaded.
    tokens.length = 0;
  }
}

if (arg === "--plan") {
  console.log("Observer synthetic A/B: PLAN ONLY. No database reads or writes.");
  console.log("Usage: --run | --revoke <12-hex-runId>. Run only from authorized semse-API Railway console.");
  process.exit(0);
}
assert.ok(arg === "--run" || arg === "--revoke", "Unknown mode");
requireProductionAuthority();
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const actors = identities(runId);
try {
  if (arg === "--revoke") {
    await disableSyntheticAccounts(prisma, actors);
    console.log(JSON.stringify({ result: "REVOKED", runId }));
  } else {
    console.log(JSON.stringify({ result: "BEGIN", runId, accounts: 2, tenants: 2 }));
    let created = false;
    let outcome;
    try {
      await assertRelease();
      await seed(prisma, actors);
      created = true;
      outcome = await verify(prisma, actors);
    } finally {
      // This is not a demo seed. Leave NO active admin credentials behind;
      // synthetic AuditLog entries remain for auditability.
      if (created) {
        await disableSyntheticAccounts(prisma, actors);
        console.log(JSON.stringify({ result: "DISABLED", runId, accounts: 2 }));
      } else {
        // A partially created fixture is also disabled; safe only with IDs
        // and names generated here, validated by disableSyntheticAccounts().
        await disableSyntheticAccounts(prisma, actors);
      }
      for (const a of actors) {
        a.password = undefined;
        a.passwordHash = undefined;
      }
    }
    // Mark the full smoke PASS only AFTER revocation and suspension succeed.
    console.log(JSON.stringify({ result: "PASS", runId, ...outcome }));
  }
} finally {
  await prisma.$disconnect();
}
