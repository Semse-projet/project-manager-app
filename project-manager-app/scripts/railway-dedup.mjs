#!/usr/bin/env node
/**
 * Railway one-off deduplication job.
 * Removes duplicate rows created by concurrent bridge runs.
 *
 * Uses the 'pg' package — works without psql CLI in the container.
 *
 * Required env:
 *   DATABASE_URL — PostgreSQL connection string
 *
 * Usage (Railway one-off):
 *   node scripts/railway-dedup.mjs
 *
 * Or deploy as a Railway ephemeral service pointing to this file.
 */

import pg from "pg";

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL });

const DEDUP_STEPS = [
  {
    name: "Milestone duplicates (same projectId + sequence, keep oldest)",
    count: `
      SELECT COUNT(*) FROM "Milestone" m1
      WHERE EXISTS (
        SELECT 1 FROM "Milestone" m2
        WHERE m1."projectId" = m2."projectId"
          AND m1."sequence" = m2."sequence"
          AND m1."deletedAt" IS NULL
          AND m2."deletedAt" IS NULL
          AND m1.id > m2.id
      )`,
    delete: `
      DELETE FROM "Milestone" m1
      WHERE EXISTS (
        SELECT 1 FROM "Milestone" m2
        WHERE m1."projectId" = m2."projectId"
          AND m1."sequence" = m2."sequence"
          AND m1."deletedAt" IS NULL
          AND m2."deletedAt" IS NULL
          AND m1.id > m2.id
      )`,
  },
  {
    name: "BuildOpsProject duplicates (same jobId, keep oldest)",
    count: `
      SELECT COUNT(*) FROM "BuildOpsProject" b1
      WHERE EXISTS (
        SELECT 1 FROM "BuildOpsProject" b2
        WHERE b1."jobId" = b2."jobId"
          AND b1.id > b2.id
      )`,
    delete: `
      DELETE FROM "BuildOpsProject" b1
      WHERE EXISTS (
        SELECT 1 FROM "BuildOpsProject" b2
        WHERE b1."jobId" = b2."jobId"
          AND b1.id > b2.id
      )`,
  },
  {
    name: "BuildOpsTask duplicates (same projectId + templateKey, keep oldest)",
    count: `
      SELECT COUNT(*) FROM "BuildOpsTask" t1
      WHERE EXISTS (
        SELECT 1 FROM "BuildOpsTask" t2
        WHERE t1."projectId" = t2."projectId"
          AND t1."templateKey" = t2."templateKey"
          AND t1.id > t2.id
      )`,
    delete: `
      DELETE FROM "BuildOpsTask" t1
      WHERE EXISTS (
        SELECT 1 FROM "BuildOpsTask" t2
        WHERE t1."projectId" = t2."projectId"
          AND t1."templateKey" = t2."templateKey"
          AND t1.id > t2.id
      )`,
  },
  {
    name: "Evidence duplicates (same projectId + promotedFrom + bucketKey, keep oldest)",
    count: `
      SELECT COUNT(*) FROM "Evidence" e1
      WHERE EXISTS (
        SELECT 1 FROM "Evidence" e2
        WHERE e1."projectId" = e2."projectId"
          AND e1."promotedFromBuildOpsProjectId" = e2."promotedFromBuildOpsProjectId"
          AND e1."bucketKey" = e2."bucketKey"
          AND e1.id > e2.id
      )`,
    delete: `
      DELETE FROM "Evidence" e1
      WHERE EXISTS (
        SELECT 1 FROM "Evidence" e2
        WHERE e1."projectId" = e2."projectId"
          AND e1."promotedFromBuildOpsProjectId" = e2."promotedFromBuildOpsProjectId"
          AND e1."bucketKey" = e2."bucketKey"
          AND e1.id > e2.id
      )`,
  },
  {
    name: "JobTask duplicates (same jobId + promotedFromBuildOpsTaskId, keep oldest)",
    count: `
      SELECT COUNT(*) FROM "JobTask" jt1
      WHERE EXISTS (
        SELECT 1 FROM "JobTask" jt2
        WHERE jt1."jobId" = jt2."jobId"
          AND jt1."promotedFromBuildOpsTaskId" = jt2."promotedFromBuildOpsTaskId"
          AND jt1.id > jt2.id
      )`,
    delete: `
      DELETE FROM "JobTask" jt1
      WHERE EXISTS (
        SELECT 1 FROM "JobTask" jt2
        WHERE jt1."jobId" = jt2."jobId"
          AND jt1."promotedFromBuildOpsTaskId" = jt2."promotedFromBuildOpsTaskId"
          AND jt1.id > jt2.id
      )`,
  },
  {
    name: "Project duplicates (same promotedFromBuildOpsProjectId, keep oldest)",
    count: `
      SELECT COUNT(*) FROM "Project" p1
      WHERE EXISTS (
        SELECT 1 FROM "Project" p2
        WHERE p1."promotedFromBuildOpsProjectId" = p2."promotedFromBuildOpsProjectId"
          AND p1."promotedFromBuildOpsProjectId" IS NOT NULL
          AND p1.id > p2.id
      )`,
    delete: `
      DELETE FROM "Project" p1
      WHERE EXISTS (
        SELECT 1 FROM "Project" p2
        WHERE p1."promotedFromBuildOpsProjectId" = p2."promotedFromBuildOpsProjectId"
          AND p1."promotedFromBuildOpsProjectId" IS NOT NULL
          AND p1.id > p2.id
      )`,
  },
];

async function main() {
  console.log("🔄 Conectando a la base de datos...");
  await client.connect();
  console.log("✅ Conectado\n");

  let totalDeleted = 0;
  const results = [];

  for (const step of DEDUP_STEPS) {
    // Count first
    const countRes = await client.query(step.count);
    const count = parseInt(countRes.rows[0].count, 10);

    if (count === 0) {
      console.log(`  ⬛  ${step.name}: sin duplicados`);
      results.push({ name: step.name, deleted: 0 });
      continue;
    }

    console.log(`  ⚠️  ${step.name}: ${count} duplicado(s) encontrado(s)`);

    // Delete
    const deleteRes = await client.query(step.delete);
    const deleted = deleteRes.rowCount ?? 0;
    totalDeleted += deleted;
    results.push({ name: step.name, deleted });
    console.log(`  ✅  Eliminados: ${deleted}`);
  }

  console.log(`\n${"─".repeat(55)}`);
  console.log(`  Total eliminados: ${totalDeleted} filas`);

  if (totalDeleted > 0) {
    console.log("\nDetalle:");
    for (const r of results.filter(r => r.deleted > 0)) {
      console.log(`  - ${r.name}: ${r.deleted}`);
    }
  } else {
    console.log("  ✅ Base de datos limpia — sin duplicados");
  }

  await client.end();
  console.log("\n✅ Deduplicación completada");
}

main().catch(async (err) => {
  console.error("❌ Error:", err.message);
  await client.end().catch(() => {});
  process.exit(1);
});
