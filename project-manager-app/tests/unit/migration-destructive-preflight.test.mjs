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
  // Revisión de #1199: UPDATE con alias (con y sin AS) y con ONLY/esquema.
  assert.deepEqual(scanSql('UPDATE "Evidence" AS evidence SET "tenantId" = NULL;'), ["update_rows"]);
  assert.deepEqual(scanSql('UPDATE "Evidence" evidence SET "tenantId" = NULL;'), ["update_rows"]);
  assert.deepEqual(scanSql('UPDATE ONLY public."Job" j SET "a" = 1;'), ["update_rows"]);
  // Las cláusulas de clave foránea no cuentan como UPDATE de filas.
  assert.deepEqual(scanSql('ALTER TABLE "a" ADD CONSTRAINT "f" FOREIGN KEY ("x") REFERENCES "b"("y") ON DELETE SET NULL ON UPDATE CASCADE;'), []);
  assert.deepEqual(scanSql('ALTER TABLE "a" ADD CONSTRAINT "f" FOREIGN KEY ("x") REFERENCES "b"("y") ON UPDATE SET NULL;'), []);
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

test("un marcador de comentario dentro de un literal no oculta SQL destructivo (revisión de #1199)", () => {
  const sql = [
    `ALTER TABLE "Evidence" ADD COLUMN "source" TEXT DEFAULT '--';`,
    `DROP TABLE "Job";`,
    `COMMENT ON COLUMN "Evidence"."source" IS 'origin';`,
  ].join("\n");
  assert.deepEqual(scanSql(sql), ["drop_table"]);
  // Un apóstrofo dentro de un comentario no abre un literal.
  assert.deepEqual(scanSql("-- it's fine\nDROP TABLE \"x\";"), ["drop_table"]);
  // Literales E'' con escapes, comentarios anidados e identificadores con --.
  assert.deepEqual(scanSql("SELECT E'a\\'b -- DROP TABLE z'; DROP TABLE w;"), ["drop_table"]);
  assert.deepEqual(scanSql("/* a /* nested */ DROP TABLE x; */ CREATE TABLE y();"), []);
  assert.deepEqual(scanSql('ALTER TABLE "a--b" DROP COLUMN c;'), ["drop_column"]);
  // El cuerpo de un bloque DO $$ ... $$ es código.
  assert.deepEqual(scanSql('DO $$ BEGIN UPDATE "J" SET a = 1; END $$;'), ["update_rows"]);
});

test("DROP de columna sin la palabra COLUMN también cuenta (revisión de #1199)", () => {
  assert.deepEqual(scanSql('ALTER TABLE "Evidence" DROP "tenantId";'), ["drop_column"]);
  assert.deepEqual(scanSql('ALTER TABLE "Evidence" DROP IF EXISTS "tenantId";'), ["drop_column"]);
  assert.deepEqual(scanSql('ALTER TABLE "E" ADD COLUMN "a" TEXT, DROP "b";'), ["drop_column"]);
  assert.deepEqual(scanSql('ALTER TABLE "E" DROP COLUMN "b";'), ["drop_column"]);
  // No pierden datos: restricciones y cambios de columna.
  assert.deepEqual(scanSql('ALTER TABLE "E" DROP CONSTRAINT "E_pkey";'), []);
  assert.deepEqual(scanSql('ALTER TABLE "E" DROP CONSTRAINT IF EXISTS "E_fk";'), []);
  assert.deepEqual(scanSql('ALTER TABLE "E" ALTER COLUMN "a" DROP DEFAULT;'), []);
  assert.deepEqual(scanSql('ALTER TABLE "E" ALTER COLUMN "a" DROP NOT NULL;'), []);
  assert.deepEqual(scanSql('DROP INDEX "E_idx";'), []);
});
