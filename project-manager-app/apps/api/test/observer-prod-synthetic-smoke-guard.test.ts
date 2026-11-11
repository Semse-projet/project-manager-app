import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const executable = fileURLToPath(new URL("../../../scripts/ops/observer-prod-synthetic-smoke.mjs", import.meta.url));

test("O.HI14: synthetic observer smoke is read-only by default", () => {
  const run = spawnSync(process.execPath, [executable], {
    env: { ...process.env, DATABASE_URL: "", SEMSE_OBSERVER_SMOKE_ACK: "" },
    encoding: "utf8", timeout: 15000,
  });
  assert.equal(run.status, 0, "default plan should not need database access");
  assert.match(run.stdout, /PLAN ONLY/);
  assert.doesNotMatch(run.stdout + run.stderr, /password|accessToken|refreshToken/i);
});

test("O.HI14: --apply refuses an unapproved environment before DB connection", () => {
  const run = spawnSync(process.execPath, [executable, "--apply"], {
    env: {
      ...process.env,
      RAILWAY_PROJECT_ID: "wrong-project",
      RAILWAY_ENVIRONMENT_NAME: "production",
      RAILWAY_SERVICE_ID: "wrong-service",
      SEMSE_OBSERVER_SMOKE_ACK: "",
      DATABASE_URL: "",
      NODE_ENV: "production",
    },
    encoding: "utf8", timeout: 15000,
  });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /Wrong Railway project/);
  assert.doesNotMatch(run.stdout + run.stderr, /passwordHash|accessToken|BEGIN/);
});

test("O.HI14: --apply refuses the right project but incorrect API service", () => {
  const run = spawnSync(process.execPath, [executable, "--apply"], {
    env: {
      ...process.env,
      RAILWAY_PROJECT_ID: "95ad1b14-d1d9-467d-82d8-5354619ba873",
      RAILWAY_ENVIRONMENT_NAME: "production",
      RAILWAY_ENVIRONMENT_ID: "d682210a-956a-4508-9c5b-4ca5959278f9",
      RAILWAY_SERVICE_ID: "wrong-service",
      SEMSE_OBSERVER_SMOKE_ACK: "YES_OBSERVER_1089_SYNTHETIC_WRITE_AND_CLEANUP",
      DATABASE_URL: "",
      NODE_ENV: "production",
    },
    encoding: "utf8", timeout: 15000,
  });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /Only the existing semse-API service/);
});

test("O.HI14: --apply refuses to run in CI even in the designated service", () => {
  const run = spawnSync(process.execPath, [executable, "--apply"], {
    env: {
      ...process.env,
      CI: "true",
      RAILWAY_PROJECT_ID: "95ad1b14-d1d9-467d-82d8-5354619ba873",
      RAILWAY_ENVIRONMENT_NAME: "production",
      RAILWAY_ENVIRONMENT_ID: "d682210a-956a-4508-9c5b-4ca5959278f9",
      RAILWAY_SERVICE_ID: "2bd1bd3f-9aa1-4fc3-a714-4cf90c52c770",
      SEMSE_OBSERVER_SMOKE_ACK: "YES_OBSERVER_1089_SYNTHETIC_WRITE_AND_CLEANUP",
      DATABASE_URL: "postgresql://dummy:dummy@postgres.railway.internal/semse",
      NODE_ENV: "production",
    },
    encoding: "utf8", timeout: 15000,
  });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /Forbidden in CI/);
  assert.doesNotMatch(run.stdout + run.stderr, /FIXTURES CREATED|SMOKE PASS|accessToken/);
});

test("O.HI14: recovery cleanup refuses to write without current production SHA", () => {
  const run = spawnSync(process.execPath, [executable, "--apply", "--cleanup=0123456789abcdef"], {
    env: {
      ...process.env,
      CI: "false",
      RAILWAY_PROJECT_ID: "95ad1b14-d1d9-467d-82d8-5354619ba873",
      RAILWAY_ENVIRONMENT_NAME: "production",
      RAILWAY_ENVIRONMENT_ID: "d682210a-956a-4508-9c5b-4ca5959278f9",
      RAILWAY_SERVICE_ID: "2bd1bd3f-9aa1-4fc3-a714-4cf90c52c770",
      SEMSE_OBSERVER_SMOKE_ACK: "YES_OBSERVER_1089_SYNTHETIC_WRITE_AND_CLEANUP",
      SEMSE_OBSERVER_SMOKE_EXPECTED_SHA: "",
      DATABASE_URL: "postgresql://dummy:dummy@postgres.railway.internal/semse",
      NODE_ENV: "production",
    },
    encoding: "utf8", timeout: 15000,
  });
  assert.notEqual(run.status, 0, "emergency cleanup must fail before Prisma/database writes");
  assert.match(run.stderr, /Expected current production git SHA required/);
  assert.doesNotMatch(run.stdout + run.stderr, /CLEANUP PASS|passwordHash|accessToken/);
});

test("O.HI14: concurrent-provisioning check is inside the DB write transaction", async () => {
  // Static safety-contract check; does NOT simulate a PostgreSQL execution.
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(executable, "utf8");
  assert.match(source, /await prisma\.\$transaction\(async \(tx\) => \{\s*const lock = await tx\.\$queryRaw`SELECT pg_try_advisory_xact_lock\(48110891401::bigint\) AS acquired`/);
  assert.match(source, /const recentRuns = await tx\.tenant\.count/);
  assert.match(source, /await preflight\(\{ cleanupOnly: true \}\);\s*await cleanup\(runId\)/);
  assert.match(source, /await verifyAuthAudit\(people\)/);
});

test("O.HI14: rejects a foreign snapshot in a fresh tenant", async () => {
  const { assertEmptyObserverHistory } = await import(
    new URL("../../../scripts/ops/observer-smoke-history-assertions.mjs", import.meta.url).href
  );
  const empty = { status: 200, data: { count: 0, snapshots: [] } };
  assert.doesNotThrow(() => assertEmptyObserverHistory(empty));
  // A has observed; B's history must be empty even with x-tenant-id spoofed.
  const leaked = { status: 200, data: { count: 1,
    snapshots: [{ observedAt: "2026-11-06T10:00:00.000Z" }] } };
  assert.throws(() => assertEmptyObserverHistory(leaked), /Foreign observation leaked/);
});

test("O.HI14: rejects mixed or substituted history after both tenants observe", async () => {
  const { assertOwnObserverHistory } = await import(
    new URL("../../../scripts/ops/observer-smoke-history-assertions.mjs", import.meta.url).href
  );
  const a = "2026-11-06T10:00:00.000Z";
  const b = "2026-11-06T10:00:01.000Z";
  const ownA = { status: 200, data: { count: 1, snapshots: [{ observedAt: a }] } };
  const ownB = { status: 200, data: { count: 1, snapshots: [{ observedAt: b }] } };
  assert.doesNotThrow(() => assertOwnObserverHistory(ownA, a));
  assert.doesNotThrow(() => assertOwnObserverHistory(ownB, b));
  assert.throws(() => assertOwnObserverHistory(ownA, b), /History entry does not match/);
  const mixed = { status: 200, data: { count: 2,
    snapshots: [{ observedAt: a }, { observedAt: b }] } };
  assert.throws(() => assertOwnObserverHistory(mixed, a), /exactly its own observation/);
});

test("O.HI14: smoke interleaves cross-tenant checks after each latest observation", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(executable, "utf8");
  const i = source.indexOf("const observedAtByTenant = new Map()");
  const latest = source.indexOf('"/v1/ops/observer/latest"', i);
  const otherHistory = source.indexOf("const otherHistory = await request", latest);
  const branch = source.indexOf("if (observedAtByTenant.has(other.key))", otherHistory);
  assert.ok(i > 0 && latest > i && otherHistory > latest && branch > otherHistory,
    "Each observed tenant must trigger an immediate read of the other tenant");
  assert.match(source.slice(branch, branch + 260),
    /assertOwnObserverHistory\(otherHistory, observedAtByTenant\.get\(other\.key\)\)/);
  assert.match(source.slice(branch, branch + 300),
    /assertEmptyObserverHistory\(otherHistory\)/);
});

test("O.HI14: production A/B rejects missing single-replica attestation", () => {
  const run = spawnSync(process.execPath, [executable, "--apply"], {
    env: {
      ...process.env,
      CI: "false",
      NODE_ENV: "production",
      RAILWAY_PROJECT_ID: "95ad1b14-d1d9-467d-82d8-5354619ba873",
      RAILWAY_ENVIRONMENT_NAME: "production",
      RAILWAY_ENVIRONMENT_ID: "d682210a-956a-4508-9c5b-4ca5959278f9",
      RAILWAY_SERVICE_ID: "2bd1bd3f-9aa1-4fc3-a714-4cf90c52c770",
      SEMSE_OBSERVER_SMOKE_ACK: "YES_OBSERVER_1089_SYNTHETIC_WRITE_AND_CLEANUP",
      SEMSE_OBSERVER_SMOKE_EXPECTED_SHA: "8219caa4e9999dc578a5010b939380a25c298a87",
      SEMSE_OBSERVER_SMOKE_ATTESTED_API_REPLICAS: "",
      DATABASE_URL: "postgresql://dummy:dummy@postgres.railway.internal/semse",
    },
    encoding: "utf8", timeout: 15000,
  });
  assert.notEqual(run.status, 0, "unattested multi-replica topology cannot pass");
  assert.match(run.stderr, /Operator must verify exactly 1\/1 Railway API replica/);
  assert.doesNotMatch(run.stdout + run.stderr, /FIXTURES CREATED|SMOKE PASS|CLEANUP PASS|accessToken/);
});
