import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const scriptPath = new URL("../../scripts/backup/pg-restore-drill.sh", import.meta.url);
const script = readFileSync(scriptPath, "utf8");

test("F07 restore drill Bash script passes syntax validation", { skip: process.platform === "win32" }, () => {
  const check = spawnSync("bash", ["-n", scriptPath.pathname], { encoding: "utf8" });
  assert.equal(check.status, 0, `bash -n failed: ${check.stderr}`);
});

test("F07 restore drill rejects an invalid dump before restoring and isolates destination", () => {
  assert.match(script, /DRILL_PG_IMAGE:-postgres:18/);
  assert.match(script, /head -c 5/);
  assert.match(script, /PGDMP/);
  assert.match(script, /--network none/);
  assert.match(script, /pg_restore --exit-on-error/);
  assert.match(script, /trap cleanup EXIT/);
  assert.match(script, /KEY_TABLES=\(Project Milestone PaymentEscrow PaymentTxn Evidence User Job Bid\)/);
  assert.doesNotMatch(script, /RTO real/);
});
