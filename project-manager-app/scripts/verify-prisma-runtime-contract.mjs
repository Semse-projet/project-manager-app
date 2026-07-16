#!/usr/bin/env node
/**
 * PI-01 — verify-prisma-runtime-contract
 *
 * Detecta drift entre código ↔ schema.prisma ↔ migraciones ↔ base de datos,
 * la clase de bug que llegó a producción con tests verdes:
 *   - PR #286: código usaba prisma.visionAnalysis pero el modelo no estaba en schema.prisma → 500.
 *   - PR #285: modelos de governance en schema sin tablas en la DB de prod → 500.
 *
 * Niveles:
 *   1. code→schema: todo accessor `this.prisma.<x>` / `tx.<x>` del API debe
 *      corresponder a un modelo del schema.
 *   2. schema→migrations: todo modelo debe tener CREATE TABLE (o RENAME TO)
 *      en alguna migración.
 *   3. schema→database (opcional): si hay DATABASE_URL accesible, cada tabla
 *      esperada debe existir en information_schema.tables.
 *
 * Uso:
 *   node scripts/verify-prisma-runtime-contract.mjs           # niveles 1 y 2
 *   node scripts/verify-prisma-runtime-contract.mjs --db      # + nivel 3
 *   node scripts/verify-prisma-runtime-contract.mjs --root <dir>  # raíz alterna (fixtures/tests)
 *
 * Baseline: scripts/prisma-contract-baseline.json lista drift preexistente
 * documentado. Un hallazgo en baseline se reporta como ⚠ pero no falla; el
 * objetivo es que la lista solo pueda encogerse, nunca crecer.
 *
 * No requiere base de datos (el nivel 3 es opcional y se omite sin
 * DATABASE_URL). Comentarios y strings entrecomillados se descartan antes de
 * escanear para no producir falsos positivos.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootFlagIndex = process.argv.indexOf("--root");
const ROOT =
  rootFlagIndex !== -1 && process.argv[rootFlagIndex + 1]
    ? process.argv[rootFlagIndex + 1]
    : join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_PATH = join(ROOT, "packages/db/prisma/schema.prisma");
const MIGRATIONS_DIR = join(ROOT, "packages/db/prisma/migrations");
const BASELINE_PATH = join(ROOT, "scripts/prisma-contract-baseline.json");
const CODE_DIRS = [join(ROOT, "apps/api/src")];
const CHECK_DB = process.argv.includes("--db");

let baseline = { codeToSchema: [], schemaToMigrations: [], schemaToDatabase: [] };
try {
  baseline = { ...baseline, ...JSON.parse(readFileSync(BASELINE_PATH, "utf8")) };
} catch {
  // sin baseline: todo hallazgo es error
}

const errors = [];
const warnings = [];

function report(kind, key, message) {
  if ((baseline[kind] ?? []).includes(key)) {
    warnings.push(`baseline(${kind}): ${message}`);
  } else {
    errors.push(message);
  }
}

// ── 1. Parse schema.prisma ───────────────────────────────────────────────────
const schemaSource = readFileSync(SCHEMA_PATH, "utf8");
/** model name (PascalCase) → table name (respeta @@map) */
const models = new Map();
{
  const modelBlocks = schemaSource.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm);
  for (const [, name, body] of modelBlocks) {
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    models.set(name, mapMatch ? mapMatch[1] : name);
  }
}
const accessorToModel = new Map(); // camelCase accessor → model name
for (const name of models.keys()) {
  accessorToModel.set(name.charAt(0).toLowerCase() + name.slice(1), name);
}

// ── 2. Collect prisma accessors used in code ─────────────────────────────────
const CLIENT_METHODS = new Set([
  "$transaction", "$queryRaw", "$queryRawUnsafe", "$executeRaw", "$executeRawUnsafe",
  "$connect", "$disconnect", "$on", "$use", "$extends",
]);
// tx.<x>.<verbo prisma> exige verbo conocido para no confundir otros objetos `tx`.
const PRISMA_VERBS =
  "(?:findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|findMany|create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy)";
// `?.` opcional: `this.prisma?.modelo` es el mismo contrato en runtime.
const DIRECT_RE = /this\.prisma\??\.([a-zA-Z_$][\w$]*)/g;
const TX_RE = new RegExp(`\\btx\\??\\.([a-zA-Z_][\\w]*)\\??\\.${PRISMA_VERBS}\\(`, "g");

/**
 * Blanquea comentarios (`//`, `/* *​/`) y strings de comillas simples/dobles
 * conservando los saltos de línea, para que menciones en documentación o
 * mensajes no cuenten como accesos reales. Los template literals se conservan
 * porque sus interpolaciones `${...}` sí contienen código.
 */
function stripCommentsAndStrings(source) {
  let out = "";
  let state = "code"; // code | line | block | single | double
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (state === "code") {
      if (ch === "/" && next === "/") { state = "line"; i++; out += "  "; continue; }
      if (ch === "/" && next === "*") { state = "block"; i++; out += "  "; continue; }
      if (ch === "'") { state = "single"; out += " "; continue; }
      if (ch === '"') { state = "double"; out += " "; continue; }
      out += ch;
      continue;
    }
    if (ch === "\n") { if (state === "line") state = "code"; out += "\n"; continue; }
    if (state === "block" && ch === "*" && next === "/") { state = "code"; i++; out += "  "; continue; }
    if (state === "single" && ch === "\\") { i++; out += "  "; continue; }
    if (state === "double" && ch === "\\") { i++; out += "  "; continue; }
    if (state === "single" && ch === "'") { state = "code"; out += " "; continue; }
    if (state === "double" && ch === '"') { state = "code"; out += " "; continue; }
    out += state === "line" || state === "block" || state === "single" || state === "double" ? " " : ch;
  }
  return out;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      yield* walk(full);
    } else if (/\.(ts|mts|mjs|js)$/.test(entry) && !/\.(test|spec)\./.test(entry)) {
      yield full;
    }
  }
}

const usages = new Map(); // accessor → Set<"file:línea">
for (const dir of CODE_DIRS) {
  for (const file of walk(dir)) {
    const source = stripCommentsAndStrings(readFileSync(file, "utf8"));
    for (const re of [DIRECT_RE, TX_RE]) {
      re.lastIndex = 0;
      for (const match of source.matchAll(re)) {
        const accessor = match[1];
        if (CLIENT_METHODS.has(accessor) || accessor.startsWith("$")) continue;
        const line = source.slice(0, match.index).split("\n").length;
        if (!usages.has(accessor)) usages.set(accessor, new Set());
        usages.get(accessor).add(`${file.replace(`${ROOT}/`, "")}:${line}`);
      }
    }
  }
}

// ── Nivel 1: code→schema ─────────────────────────────────────────────────────
for (const [accessor, locations] of [...usages.entries()].sort()) {
  if (!accessorToModel.has(accessor)) {
    const sample = [...locations].slice(0, 3).join(", ");
    report(
      "codeToSchema",
      accessor,
      `code→schema: \`prisma.${accessor}\` usado en código pero no existe modelo en schema.prisma (${sample})`,
    );
  }
}

// ── Nivel 2: schema→migrations ───────────────────────────────────────────────
let migrationsSql = "";
for (const entry of readdirSync(MIGRATIONS_DIR)) {
  const sqlPath = join(MIGRATIONS_DIR, entry, "migration.sql");
  try {
    migrationsSql += readFileSync(sqlPath, "utf8");
  } catch {
    // migration_lock.toml y similares
  }
}
for (const [modelName, tableName] of models) {
  const created =
    migrationsSql.includes(`CREATE TABLE "${tableName}"`) ||
    migrationsSql.includes(`CREATE TABLE IF NOT EXISTS "${tableName}"`) ||
    migrationsSql.includes(`RENAME TO "${tableName}"`);
  if (!created) {
    report(
      "schemaToMigrations",
      modelName,
      `schema→migrations: modelo ${modelName} (tabla "${tableName}") sin CREATE TABLE en ninguna migración`,
    );
  }
}

// ── Nivel 3: schema→database (opcional) ──────────────────────────────────────
async function checkDatabase() {
  let url = process.env.PRISMA_CONTRACT_DB_URL || process.env.DATABASE_URL;
  if (!url) {
    warnings.push("schema→database: sin DATABASE_URL, nivel 3 omitido");
    return;
  }
  // `?schema=public` es un parámetro de Prisma que psql rechaza — quitar SOLO
  // ese parámetro (borrar toda la query rompería sslmode=require y similares).
  // Sin esto, el nivel 3 se omitía silenciosamente incluso en CI.
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("schema");
    url = parsed.toString();
  } catch {
    // URL no estándar: se intenta tal cual
  }
  const { execFileSync } = await import("node:child_process");
  const sql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'";
  let output;
  try {
    output = execFileSync("psql", [url, "-t", "-A", "-c", sql], { encoding: "utf8", timeout: 30000 });
  } catch (err) {
    warnings.push(`schema→database: no se pudo consultar la DB (${err.message.split("\n")[0]}); nivel 3 omitido`);
    return;
  }
  const existing = new Set(output.split("\n").map((line) => line.trim()).filter(Boolean));
  for (const [modelName, tableName] of models) {
    if (!existing.has(tableName)) {
      report(
        "schemaToDatabase",
        modelName,
        `schema→database: modelo ${modelName} (tabla "${tableName}") no existe en la base de datos`,
      );
    }
  }
}

if (CHECK_DB) {
  await checkDatabase();
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log(`verify-prisma-runtime-contract`);
console.log(`  modelos en schema: ${models.size}`);
console.log(`  accessors usados en código: ${usages.size}`);
console.log(`  niveles: code→schema, schema→migrations${CHECK_DB ? ", schema→database" : ""}`);
for (const w of warnings) console.log(`  ⚠ ${w}`);
if (errors.length > 0) {
  console.error(`\n${errors.length} error(es) de contrato:`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("  ✓ sin drift detectado");
