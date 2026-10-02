#!/usr/bin/env node
/**
 * C57 — Deduplicacion de mantenimiento (operacion explicita, NO de arranque).
 *
 *   node scripts/maintenance/dedup.mjs                       # dry-run (por defecto)
 *   node scripts/maintenance/dedup.mjs --report=out.json
 *   DEDUP_APPLY_CONFIRM=I_HAVE_A_VERIFIED_BACKUP \
 *     node scripts/maintenance/dedup.mjs --apply --backup-evidence=<ref> [--max-rows=50]
 *
 * --apply: una sola transaccion (todo o nada), tope de filas, relaciones
 * verificadas por FK, grupos ambiguos bloqueados. Ver dedup-lib.mjs.
 */
import prismaClientPkg from "@prisma/client";
import { writeFileSync } from "fs";
import {
  DEDUP_TARGETS,
  classifyGroup,
  parseArgs,
  validateApplyOptions,
} from "./dedup-lib.mjs";

const { PrismaClient } = prismaClientPkg;
const q = (id) => `"${String(id).replace(/"/g, '""')}"`;

async function referencingFks(tx, table) {
  return tx.$queryRawUnsafe(
    `SELECT c.conrelid::regclass::text AS child_table,
            array_length(c.conkey, 1) AS ncols,
            (SELECT a.attname FROM pg_attribute a
              WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1]) AS child_col,
            (SELECT a.attname FROM pg_attribute a
              WHERE a.attrelid = c.confrelid AND a.attnum = c.confkey[1]) AS parent_col
       FROM pg_constraint c
      WHERE c.contype = 'f' AND c.confrelid = $1::regclass`,
    q(table),
  );
}

async function hasColumn(tx, table, column) {
  const r = await tx.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
    table,
    column,
  );
  return r.length > 0;
}

async function tableExists(tx, table) {
  const r = await tx.$queryRawUnsafe(`SELECT to_regclass($1) IS NOT NULL AS ok`, q(table));
  return r[0]?.ok === true;
}

async function planTarget(tx, target) {
  if (!(await tableExists(tx, target.table))) return { target: target.name, skipped: "tabla inexistente", groups: [] };

  const keys = target.keyColumns.map(q).join(", ");
  const notNull = target.requireNonNull.map((c) => `${q(c)} IS NOT NULL`).join(" AND ");
  const where = [notNull, target.extraWhere].filter(Boolean).join(" AND ");
  const dupKeys = await tx.$queryRawUnsafe(
    `SELECT ${keys} FROM ${q(target.table)} WHERE ${where} GROUP BY ${keys} HAVING count(*) > 1`,
  );

  const fks = await referencingFks(tx, target.table);
  const hasCreatedAt = await hasColumn(tx, target.table, "createdAt");
  const groups = [];

  for (const key of dupKeys) {
    const cond = target.keyColumns.map((c, i) => `${q(c)} = $${i + 1}`).join(" AND ");
    const extra = target.extraWhere ? ` AND ${target.extraWhere}` : "";
    const rows = await tx.$queryRawUnsafe(
      `SELECT id${hasCreatedAt ? `, "createdAt"` : ""} FROM ${q(target.table)} WHERE ${cond}${extra}`,
      ...target.keyColumns.map((c) => key[c]),
    );
    for (const row of rows) {
      let refCount = 0;
      let unverifiableRefs = false;
      for (const fk of fks) {
        if (fk.ncols !== 1 || fk.parent_col !== "id") {
          unverifiableRefs = true;
          continue;
        }
        const n = await tx.$queryRawUnsafe(
          `SELECT count(*)::int AS n FROM ${fk.child_table} WHERE ${q(fk.child_col)} = $1`,
          row.id,
        );
        refCount += n[0].n;
      }
      row.refCount = refCount;
      row.unverifiableRefs = unverifiableRefs;
    }
    groups.push({ key, rows: rows.map((r) => ({ ...r })), ...classifyGroup(rows) });
  }
  return { target: target.name, groups };
}

const opts = parseArgs(process.argv.slice(2));
const errors = validateApplyOptions(opts);
if (errors.length) {
  console.error(errors.map((e) => `[dedup] ERROR: ${e}`).join("\n"));
  process.exit(2);
}

const prisma = new PrismaClient();
const targets = opts.only ? DEDUP_TARGETS.filter((t) => t.name === opts.only) : DEDUP_TARGETS;
const report = { mode: opts.apply ? "apply" : "dry-run", generatedAt: new Date().toISOString(), backupEvidence: opts.backupEvidence, maxRows: opts.maxRows, targets: [], deleted: 0 };

try {
  await prisma.$transaction(
    async (tx) => {
      for (const t of targets) report.targets.push(await planTarget(tx, t));

      const deletable = report.targets.flatMap((t) => t.groups.flatMap((g) => (g.status === "ok" ? g.deleteIds.map((id) => ({ table: DEDUP_TARGETS.find((x) => x.name === t.target).table, id })) : [])));
      report.candidateRows = deletable.length;
      report.blockedGroups = report.targets.flatMap((t) => t.groups.filter((g) => g.status === "blocked")).length;

      if (!opts.apply) return;
      if (deletable.length > opts.maxRows) {
        throw new Error(`${deletable.length} filas a borrar exceden --max-rows=${opts.maxRows}: abortado sin cambios`);
      }
      for (const d of deletable) {
        const n = await tx.$executeRawUnsafe(`DELETE FROM ${q(d.table)} WHERE id = $1`, d.id);
        report.deleted += n;
      }
    },
    { timeout: 120_000 },
  );
} catch (err) {
  report.error = err instanceof Error ? err.message : String(err);
  report.deleted = 0; // la transaccion hizo rollback
}

const text = JSON.stringify(report, null, 2);
if (opts.report) writeFileSync(opts.report, text);
console.log(text);
await prisma.$disconnect().catch(() => {});
process.exit(report.error ? 1 : 0);
