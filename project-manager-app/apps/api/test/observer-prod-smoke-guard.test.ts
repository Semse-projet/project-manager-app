import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../../../scripts/ops/observer-ab-production-smoke.mjs", import.meta.url));

test("O.HI14: production A/B smoke --plan is non-mutating", () => {
  const out = spawnSync(process.execPath, [script, "--plan"], {
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", NODE_ENV: "test", CI: "true" },
    timeout: 10_000,
  });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /PLAN ONLY/);
  assert.doesNotMatch(out.stdout, /password|accessToken/i);
});

test("O.HI14: production A/B smoke rejects --run in CI before database import", () => {
  const out = spawnSync(process.execPath, [script, "--run"], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "", CI: "true", NODE_ENV: "production",
      SEMSE_OBSERVER_AB_APPROVAL: "EXPLICIT_PRODUCTION_AB_SMOKE",
      RAILWAY_PROJECT_ID: "95ad1b14-d1d9-467d-82d8-5354619ba873",
      RAILWAY_ENVIRONMENT_ID: "d682210a-956a-4508-9c5b-4ca5959278f9",
      RAILWAY_SERVICE_ID: "2bd1bd3f-9aa1-4fc3-a714-4cf90c52c770",
      DATABASE_URL: "postgresql://dummy:dummy@postgres.railway.internal/semse",
    },
    timeout: 10_000,
  });
  assert.notEqual(out.status, 0);
  assert.match(out.stderr, /Forbidden in CI/);
  assert.doesNotMatch(out.stdout, /BEGIN|PASS|DISABLED/);
});

test("O.HI14: recovery cannot execute without explicit production approval", () => {
  const out = spawnSync(process.execPath, [script, "--revoke", "012345abcdef"], {
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", NODE_ENV: "production" },
    timeout: 10_000,
  });
  assert.notEqual(out.status, 0);
  assert.match(out.stderr, /Unexpected Railway project/);
  assert.doesNotMatch(out.stdout, /REVOKED/);
});
