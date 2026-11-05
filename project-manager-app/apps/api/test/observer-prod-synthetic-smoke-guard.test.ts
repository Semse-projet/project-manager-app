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
