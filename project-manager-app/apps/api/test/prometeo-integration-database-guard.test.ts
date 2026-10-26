/** P0 #974: the write-capable SQL negative suite must never target a live DB. */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = resolve(here, "prometeo-documents-scope-integration.test.ts");

function shouldRejectDatabaseTarget(url: string, ci = false): void {
  const result = spawnSync(process.execPath,
    ["--experimental-strip-types", "--test", fixture],
    {
      cwd: here,
      env: {
        ...process.env,
        DATABASE_URL: url,
        CI: String(ci),
        GITHUB_ACTIONS: String(ci),
        SEMSE_PROMETEO_ISOLATED_DB_TEST: "0",
      },
      encoding: "utf8",
      timeout: 20_000,
    },
  );
  assert.equal(result.error, undefined, String(result.error));
  assert.notEqual(result.status, 0, "unsafe SQL integration target must fail closed");
  assert.match(result.stderr + result.stdout,
    /P0 document scope integration refuses a non-isolated database target/,
    "test must stop at the guard before opening a connection or mutating data");
}

test("P0 SQL fixture refuses a remote production-like Postgres", () => {
  shouldRejectDatabaseTarget("postgresql://qa:qa@database.example.invalid:5432/semse?schema=public");
});

test("P0 SQL fixture refuses local 5432 even when GitHub CI flags are spoofed", () => {
  shouldRejectDatabaseTarget("postgresql://qa:qa@127.0.0.1:5432/semse?schema=public", true);
});

test("P0 SQL fixture refuses CI port 5433 without actual CI or local QA opt-in", () => {
  shouldRejectDatabaseTarget("postgresql://qa:qa@127.0.0.1:5433/semse?schema=public");
});
