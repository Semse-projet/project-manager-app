import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../../../scripts/ops/observer-production-smoke.mjs", import.meta.url));

test("Observer smoke provisioner defaults to read-only dry run", () => {
  const run = spawnSync(process.execPath, [script], {
    encoding: "utf8", env: { NODE_ENV: "test" }, timeout: 10000,
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /DRY RUN: no accounts created/);
});

test("Observer smoke provisioner refuses --apply outside approved Railway production", () => {
  const run = spawnSync(process.execPath, [script, "--apply"], {
    encoding: "utf8", timeout: 10000,
    env: {
      NODE_ENV: "production",
      RAILWAY_PROJECT_ID: "00000000-0000-0000-0000-000000000000",
      RAILWAY_ENVIRONMENT_NAME: "production",
      SEMSE_OBSERVER_SMOKE_ACK: "PR1089_SYNTHETIC_ONLY",
      DATABASE_URL: "postgresql://dummy:dummy@postgres.railway.internal:5432/railway",
    },
  });
  assert.notEqual(run.status, 0, "Unexpected permission to provision accounts");
  assert.match(run.stderr, /Wrong Railway project/);
});

test("Observer smoke provisioner refuses missing explicit one-shot approval", () => {
  const run = spawnSync(process.execPath, [script, "--apply"], {
    encoding: "utf8", timeout: 10000,
    env: {
      NODE_ENV: "production",
      RAILWAY_PROJECT_ID: "95ad1b14-d1d9-467d-82d8-5354619ba873",
      RAILWAY_ENVIRONMENT_NAME: "production",
      DATABASE_URL: "postgresql://dummy:dummy@postgres.railway.internal:5432/railway",
    },
  });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /Missing explicit opt-in/);
});
