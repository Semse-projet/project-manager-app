#!/usr/bin/env node
/**
 * Preflight de migraciones destructivas (SDD platform.release-provenance §9.2,
 * prueba G-R05 paso 3; incidente 9e2f87f1).
 *
 * Antes de desplegar, revisa las migraciones de Prisma que cambian entre lo que
 * se sirve (served) y el candidato. Un rollback de código NO revierte la base
 * (G-R05 paso 2), así que una migración que borra o reescribe datos tiene que
 * pasar por una aprobación humana con copia de seguridad identificada.
 *
 * Bloquea (fail closed) si:
 *   - una migración NUEVA contiene sentencias destructivas (DROP TABLE/COLUMN/
 *     SCHEMA/TYPE/VIEW, TRUNCATE, DELETE FROM, UPDATE ... SET, ALTER COLUMN ...
 *     TYPE, RENAME) y no figura en el archivo de aprobaciones con approvedBy y
 *     backupRef;
 *   - una migración ya existente se MODIFICA o se BORRA del disco (la base ya la
 *     tiene aplicada: Prisma no la deshace y pre-migrate no avisa);
 *   - no se puede calcular el diff (SHA inválido o git falla).
 * DROP INDEX / DROP CONSTRAINT no se consideran destructivos: no pierden datos.
 *
 * Aprobaciones: packages/db/prisma/destructive-migrations.approved.json
 *   { "<carpeta_de_migración>": { "approvedBy": "...", "backupRef": "...", "reason": "..." } }
 * El archivo viaja en el mismo PR, así que la aprobación queda revisada y fechada.
 *
 * Uso CLI (checkout con historia completa, cwd = project-manager-app/):
 *   node scripts/migration-destructive-preflight.mjs --served=<sha> --candidate=<sha>
 * Salida: JSON {action, reason, findings}. Exit 0 = ok, 3 = blocked, 2 = uso.
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SHA = /^[0-9a-f]{40}$/;
export const MIGRATIONS_DIR = "project-manager-app/packages/db/prisma/migrations/";
export const APPROVALS_PATH = "project-manager-app/packages/db/prisma/destructive-migrations.approved.json";

const RULES = [
  { id: "drop_table", re: /\bDROP\s+TABLE\b/i },
  { id: "drop_column", re: /\bDROP\s+COLUMN\b/i },
  // ALTER TABLE ... DROP [COLUMN] [IF EXISTS] col: COLUMN es opcional en Postgres.
  // No cuentan DROP CONSTRAINT ni los cambios de columna (DROP DEFAULT,
  // DROP NOT NULL, DROP IDENTITY, DROP EXPRESSION).
  { id: "drop_column", re: /\bALTER\s+TABLE\b[^;]*?\bDROP\s+(IF\s+EXISTS\s+)?(?!(CONSTRAINT|COLUMN|DEFAULT|NOT|IDENTITY|EXPRESSION)\b)("[^"]+"|\w+)/i },
  { id: "drop_schema", re: /\bDROP\s+SCHEMA\b/i },
  { id: "drop_type", re: /\bDROP\s+TYPE\b/i },
  { id: "drop_view", re: /\bDROP\s+(MATERIALIZED\s+)?VIEW\b/i },
  { id: "truncate", re: /\bTRUNCATE\b/i },
  { id: "delete_rows", re: /\bDELETE\s+FROM\b/i },
  // UPDATE [ONLY] tabla[.esquema] [[AS] alias] SET ... (el alias es opcional, con o sin AS)
  { id: "update_rows", re: /\bUPDATE\s+(ONLY\s+)?("[^"]+"|\w+)(\s*\.\s*("[^"]+"|\w+))?(\s+(AS\s+)?("[^"]+"|\w+))?\s+SET\b/i },
  // COLUMN es opcional en PostgreSQL: ALTER TABLE t ALTER "c" TYPE ... también cambia el tipo.
  { id: "alter_column_type", re: /\bALTER\s+(COLUMN\s+)?("[^"]+"|\w+)\s+(SET\s+DATA\s+)?TYPE\b/i },
  // COLUMN también es opcional: ALTER TABLE t RENAME "a" TO "b" renombra una columna.
  { id: "rename", re: /\bRENAME\s+(COLUMN\b|TO\b|CONSTRAINT\b|("[^"]+"|\w+)\s+TO\b)/i },
];

/**
 * Quita comentarios SQL (-- y /* *\/, anidados como en Postgres) y vacía los
 * literales de texto ('...', E'...') en una sola pasada, para que un marcador
 * de comentario dentro de un literal (p. ej. DEFAULT '--') no oculte SQL
 * ejecutable, ni un apóstrofo dentro de un comentario abra un literal falso.
 * Los identificadores entre comillas dobles se conservan tal cual. El cuerpo
 * de los bloques $$ ... $$ se trata como código (un DO $$ UPDATE ... $$ cuenta).
 */
export function stripSql(sql) {
  const src = String(sql);
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];
    if (ch === "-" && next === "-") {
      while (i < n && src[i] !== "\n") i++;
      out += " ";
      continue;
    }
    if (ch === "/" && next === "*") {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (src[i] === "/" && src[i + 1] === "*") { depth++; i += 2; continue; }
        if (src[i] === "*" && src[i + 1] === "/") { depth--; i += 2; continue; }
        i++;
      }
      out += " ";
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '"' && src[j + 1] === '"') { j += 2; continue; }
        if (src[j] === '"') { j++; break; }
        j++;
      }
      out += src.slice(i, j);
      i = j;
      continue;
    }
    if (ch === "'") {
      const escapes = /[eE]/.test(src[i - 1] ?? "") && !/[\w$]/.test(src[i - 2] ?? "");
      let j = i + 1;
      while (j < n) {
        if (escapes && src[j] === "\\") { j += 2; continue; }
        if (src[j] === "'" && src[j + 1] === "'") { j += 2; continue; }
        if (src[j] === "'") { j++; break; }
        j++;
      }
      out += "''";
      i = j;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

export function scanSql(sql) {
  const clean = stripSql(sql);
  return [...new Set(RULES.filter((r) => r.re.test(clean)).map((r) => r.id))];
}

/** Nombre de la carpeta de migración a partir de una ruta del diff, o null. */
export function migrationOf(path) {
  if (!path.startsWith(MIGRATIONS_DIR)) return null;
  const rest = path.slice(MIGRATIONS_DIR.length).split("/");
  return rest.length >= 2 ? rest[0] : null;
}

/**
 * changes: [{status: 'A'|'M'|'D'|'R...', path, sql?}] (solo migration.sql)
 * approvals: objeto del archivo de aprobaciones (o {}).
 */
export function decidePreflight({ changes, approvals }) {
  const findings = [];
  for (const ch of changes) {
    const name = migrationOf(ch.path);
    if (!name || !ch.path.endsWith("/migration.sql")) continue;
    const st = ch.status[0];
    if (st === "D" || st === "R") {
      findings.push({ migration: name, kind: "removed", detail: "migración aplicada eliminada o renombrada en disco" });
      continue;
    }
    if (st === "M") {
      findings.push({ migration: name, kind: "modified", detail: "migración ya aplicada modificada" });
      continue;
    }
    const hits = scanSql(ch.sql ?? "");
    if (hits.length) findings.push({ migration: name, kind: "destructive", detail: hits.join(",") });
  }
  const blocking = findings.filter((f) => {
    const ap = approvals?.[f.migration];
    return !(ap && String(ap.approvedBy ?? "").trim() && String(ap.backupRef ?? "").trim());
  });
  if (blocking.length) {
    return {
      action: "blocked",
      reason: `${blocking.length} migración(es) requieren aprobación con backup: ${blocking.map((f) => `${f.migration} (${f.kind}: ${f.detail})`).join("; ")}`,
      findings,
    };
  }
  return {
    action: "ok",
    reason: findings.length ? `${findings.length} hallazgo(s), todos aprobados con backupRef` : "sin migraciones destructivas",
    findings,
  };
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

export function collectChanges(served, candidate) {
  const out = git(["diff", "--name-status", "--no-renames", `${served}`, `${candidate}`, "--", MIGRATIONS_DIR]);
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, path] = line.split("\t");
      const ch = { status, path };
      if (status[0] === "A" && path.endsWith("/migration.sql")) ch.sql = git(["show", `${candidate}:${path}`]);
      return ch;
    });
}

export function loadApprovals(candidate) {
  try {
    return JSON.parse(git(["show", `${candidate}:${APPROVALS_PATH}`]));
  } catch (err) {
    if (/does not exist|exists on disk, but not in|fatal: path/i.test(String(err?.stderr ?? err?.message ?? ""))) return {};
    throw err;
  }
}

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const served = String(arg("served") ?? "").toLowerCase();
  const candidate = String(arg("candidate") ?? "").toLowerCase();
  if (!arg("served") || !arg("candidate")) {
    console.error("uso: --served=<sha> --candidate=<sha>");
    process.exit(2);
  }
  let result;
  try {
    if (!SHA.test(served) || !SHA.test(candidate)) throw new Error(`SHA inválido (served='${served}', candidate='${candidate}')`);
    const root = git(["rev-parse", "--show-toplevel"]).trim();
    process.chdir(root);
    result = decidePreflight({ changes: collectChanges(served, candidate), approvals: loadApprovals(candidate) });
  } catch (err) {
    result = { action: "blocked", reason: `preflight no evaluable: ${String(err?.message ?? err).split("\n")[0]}`, findings: [] };
  }
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exit(result.action === "blocked" ? 3 : 0);
}
