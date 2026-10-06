import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// H05 (#796): el primer despliegue de semse-API fallo con P3018 porque la tabla base `prometeo_tool_invocation_audit`
// no existia en produccion (migracion fantasma de 20260722000000_prometeo_tool_governance), y el intento fallido dejo en
// `_prisma_migrations` una fila sin terminar que bloquea TODOS los despliegues (P3009). Estas pruebas (sin base de
// datos) fijan los tres puntos de la reparacion para que no se pierdan.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const script = readFileSync(resolve(ROOT, "scripts/pre-migrate.mjs"), "utf8");
const MIGRATION = "20261005160000_h05_tool_call_audit_lifecycle";
const migrationDir = resolve(ROOT, "packages/db/prisma/migrations", MIGRATION);
const sql = existsSync(resolve(migrationDir, "migration.sql")) ? readFileSync(resolve(migrationDir, "migration.sql"), "utf8") : "";

// El SQL sin comentarios de linea (los de cabecera mencionan DROP/CREATE a modo de rollback documentado).
const code = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

test("la migración fallida de H05 está en FAILED_MIGRATION_REPAIRS junto al caso anterior", () => {
  const match = script.match(/const FAILED_MIGRATION_REPAIRS = \[([^\]]*)\];/);
  assert.ok(match, "FAILED_MIGRATION_REPAIRS debe seguir siendo una lista explícita");
  const names = [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(names.includes(MIGRATION), "la migración H05 debe poder repararse");
  assert.ok(names.includes("20260916_fix_contributor_terms_v1_0"), "no se debe perder el caso anterior");
  assert.equal(names.length, 2, "es una lista revisada a mano: cualquier otro nombre requiere revisión explícita");
});

test("la carpeta de la migración reparada sigue en el repo (si no, borrar su fila la dejaría huérfana)", () => {
  assert.ok(existsSync(resolve(migrationDir, "migration.sql")), `${MIGRATION}/migration.sql debe existir`);
});

test("repairFailedMigrations solo toca filas sin terminar y de la lista, y corre ANTES de migrate deploy", () => {
  const repair = script.slice(script.indexOf("async function repairFailedMigrations"), script.indexOf("// Main"));
  assert.match(repair, /WHERE finished_at IS NULL/, "solo filas sin terminar");
  assert.match(repair, /FAILED_MIGRATION_REPAIRS\.includes\(row\.migration_name\)\) continue/, "solo nombres de la lista");
  assert.match(repair, /DELETE FROM "_prisma_migrations" WHERE migration_name = \$1/, "borra por nombre exacto, parametrizado");

  const calls = script.slice(script.indexOf("// Main"));
  const repairAt = calls.indexOf("await repairFailedMigrations()");
  const deployAt = calls.indexOf('"migrate", "deploy"');
  assert.ok(repairAt > 0 && deployAt > 0, "ambas llamadas deben existir");
  assert.ok(repairAt < deployAt, "la reparación debe ejecutarse antes de migrate deploy");
});

test("la migración H05 es idempotente: nada se crea sin IF NOT EXISTS", () => {
  assert.ok(code.trim().length > 0, "la migración debe tener SQL");
  for (const stmt of code.match(/CREATE TABLE[^;]*?\(/g) ?? []) {
    assert.match(stmt, /CREATE TABLE IF NOT EXISTS/, `tabla sin IF NOT EXISTS: ${stmt}`);
  }
  for (const stmt of code.match(/CREATE (UNIQUE )?INDEX[^;]*;/g) ?? []) {
    assert.match(stmt, /CREATE (UNIQUE )?INDEX IF NOT EXISTS/, `índice sin IF NOT EXISTS: ${stmt.slice(0, 80)}`);
  }
  const addColumns = code.match(/ADD COLUMN[^,;]*/g) ?? [];
  assert.ok(addColumns.length >= 25, "debe añadir las columnas de ambas tablas");
  for (const col of addColumns) assert.match(col, /ADD COLUMN IF NOT EXISTS/, `columna sin IF NOT EXISTS: ${col}`);
  // CREATE TYPE no admite IF NOT EXISTS: solo se permite dentro de un bloque DO que compruebe pg_type.
  const types = code.match(/CREATE TYPE[^;]*;/g) ?? [];
  for (const stmt of types) {
    const before = code.slice(0, code.indexOf(stmt));
    assert.match(before.slice(before.lastIndexOf("DO $$")), /IF NOT EXISTS \(SELECT 1 FROM pg_type/, "CREATE TYPE solo dentro de un DO con comprobación");
  }
  assert.equal(/\bDROP\b|\bDELETE\b|\bTRUNCATE\b/i.test(code), false, "la migración es aditiva: no borra nada");
});

test("la migración H05 recrea los objetos de la migración fantasma (tabla de auditoría, acción propuesta y enum)", () => {
  assert.match(code, /CREATE TABLE IF NOT EXISTS "prometeo_tool_invocation_audit"/);
  assert.match(code, /CREATE TABLE IF NOT EXISTS "prometeo_proposed_action"/);
  assert.match(code, /pg_type WHERE typname = 'PrometeoProposedActionStatus'/);
  // el orden importa: la tabla base debe existir antes del ALTER que añade columnas
  assert.ok(
    code.indexOf('CREATE TABLE IF NOT EXISTS "prometeo_tool_invocation_audit"') < code.indexOf('ALTER TABLE "prometeo_tool_invocation_audit"'),
    "la tabla base se asegura antes de alterarla",
  );
});
