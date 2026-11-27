// G-R05 paso 3 (unit + git real): una migración destructiva o la eliminación
// de una migración ya aplicada no puede desplegarse sin aprobación con backup.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { scanSql, decidePreflight, MIGRATIONS_DIR, APPROVALS_PATH } from "../../scripts/migration-destructive-preflight.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "../../scripts/migration-destructive-preflight.mjs");
const add = (name, sql) => ({ status: "A", path: `${MIGRATIONS_DIR}${name}/migration.sql`, sql });

test("scanSql detecta sentencias destructivas", () => {
  assert.deepEqual(scanSql('DROP TABLE "x";'), ["drop_table"]);
  assert.deepEqual(scanSql('ALTER TABLE "x" DROP COLUMN "y";'), ["drop_column"]);
  assert.deepEqual(scanSql('ALTER TABLE "x" ALTER COLUMN "y" SET DATA TYPE INTEGER;'), ["alter_column_type"]);
  assert.deepEqual(scanSql('ALTER TABLE "x" RENAME COLUMN "a" TO "b";'), ["rename"]);
  assert.deepEqual(scanSql('UPDATE "x" SET "a" = 1;'), ["update_rows"]);
  assert.deepEqual(scanSql('DELETE FROM "x";'), ["delete_rows"]);
  assert.deepEqual(scanSql('TRUNCATE "x";'), ["truncate"]);
});

test("scanSql no marca migraciones aditivas, comentarios ni literales", () => {
  assert.deepEqual(scanSql('CREATE TABLE IF NOT EXISTS "p" ("id" TEXT PRIMARY KEY);\nCREATE INDEX "i" ON "p"("id");'), []);
  assert.deepEqual(scanSql('DROP INDEX "i";\nALTER TABLE "p" DROP CONSTRAINT "fk";'), []);
  assert.deepEqual(scanSql("-- DROP TABLE x\n/* TRUNCATE y */\nINSERT INTO \"p\" VALUES ('DROP TABLE z');"), []);
});

test("migración aditiva -> ok", () => {
  assert.equal(decidePreflight({ changes: [add("m1", 'CREATE TABLE "p" ("id" TEXT);')], approvals: {} }).action, "ok");
});

test("migración destructiva sin aprobación -> blocked", () => {
  const r = decidePreflight({ changes: [add("m2", 'DROP TABLE "p";')], approvals: {} });
  assert.equal(r.action, "blocked");
  assert.match(r.reason, /m2 \(destructive: drop_table\)/);
});

test("aprobación sin backupRef no basta -> blocked", () => {
  const r = decidePreflight({ changes: [add("m2", 'DROP TABLE "p";')], approvals: { m2: { approvedBy: "dueño" } } });
  assert.equal(r.action, "blocked");
});

test("aprobación con approvedBy y backupRef -> ok", () => {
  const r = decidePreflight({
    changes: [add("m2", 'DROP TABLE "p";')],
    approvals: { m2: { approvedBy: "dueño", backupRef: "railway-backup-2026-11-27T12:00Z" } },
  });
  assert.equal(r.action, "ok");
  assert.equal(r.findings.length, 1);
});

test("borrar o modificar una migración ya aplicada -> blocked", () => {
  for (const status of ["D", "M"]) {
    const r = decidePreflight({ changes: [{ status, path: `${MIGRATIONS_DIR}m1/migration.sql` }], approvals: {} });
    assert.equal(r.action, "blocked", status);
  }
});

test("CLI contra git real: aditiva ok, revert blocked, destructiva blocked, aprobada ok, SHA inválido blocked", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "preflight-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const g = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8" }).trim();
  const write = (p, c) => { mkdirSync(join(dir, dirname(p)), { recursive: true }); writeFileSync(join(dir, p), c); };
  const commit = (m) => { g("add", "-A"); g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", m, "--allow-empty"); return g("rev-parse", "HEAD"); };
  const run = (served, candidate) => {
    try {
      return { code: 0, ...JSON.parse(execFileSync("node", [SCRIPT, `--served=${served}`, `--candidate=${candidate}`], { cwd: dir, encoding: "utf8" })) };
    } catch (e) {
      return { code: e.status, ...JSON.parse(e.stdout) };
    }
  };
  g("init", "-q");
  write(`${MIGRATIONS_DIR}m0/migration.sql`, 'CREATE TABLE "a" ("id" TEXT);');
  const base = commit("base");
  write(`${MIGRATIONS_DIR}m1/migration.sql`, 'CREATE TABLE "p" ("id" TEXT);');
  const m1 = commit("m1 aditiva");
  g("rm", "-rq", `${MIGRATIONS_DIR}m1`);
  const m2 = commit("revert m1");
  write(`${MIGRATIONS_DIR}m3/migration.sql`, 'DROP TABLE "a";');
  const m3 = commit("m3 destructiva");
  write(APPROVALS_PATH, JSON.stringify({ m3: { approvedBy: "dueño", backupRef: "bk-1" } }));
  const m4 = commit("aprobación m3");

  assert.equal(run(base, m1).action, "ok");
  const rev = run(m1, m2);
  assert.equal(rev.action, "blocked");
  assert.equal(rev.code, 3);
  assert.equal(run(m2, m3).action, "blocked");
  assert.equal(run(m2, m4).action, "ok");
  assert.equal(run("unknown", m4).action, "blocked");
});
