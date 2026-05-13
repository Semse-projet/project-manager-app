#!/usr/bin/env node
/**
 * Pre-migration dedup script — runs BEFORE prisma migrate deploy.
 * Removes duplicate rows that would violate unique constraints added
 * in migrations 20260512110000, 20260512143000, 20260512170000.
 *
 * Uses @prisma/client directly — no psql CLI required.
 * Called by Dockerfile.api startup sequence.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runDedup() {
  let total = 0;

  const steps = [
    {
      name: "BuildOpsProject (same jobId — unique constraint)",
      sql: `
        DELETE FROM "BuildOpsProject" b1
        USING "BuildOpsProject" b2
        WHERE b1."jobId" = b2."jobId"
          AND b1.id > b2.id
      `,
    },
    {
      name: "BuildOpsTask (same projectId+templateKey — unique constraint)",
      sql: `
        DELETE FROM "BuildOpsTask" t1
        USING "BuildOpsTask" t2
        WHERE t1."projectId" = t2."projectId"
          AND t1."templateKey" = t2."templateKey"
          AND t1.id > t2.id
      `,
    },
    {
      name: "Milestone (same projectId+sequence, not deleted — unique index)",
      sql: `
        DELETE FROM "Milestone" m1
        USING "Milestone" m2
        WHERE m1."projectId" = m2."projectId"
          AND m1."sequence" = m2."sequence"
          AND m1."deletedAt" IS NULL
          AND m2."deletedAt" IS NULL
          AND m1.id > m2.id
      `,
    },
    {
      name: "Project (same promotedFromBuildOpsProjectId — unique constraint)",
      sql: `
        DELETE FROM "Project" p1
        USING "Project" p2
        WHERE p1."promotedFromBuildOpsProjectId" = p2."promotedFromBuildOpsProjectId"
          AND p1."promotedFromBuildOpsProjectId" IS NOT NULL
          AND p1.id > p2.id
      `,
    },
    {
      name: "JobTask (same jobId+promotedFromBuildOpsTaskId)",
      sql: `
        DELETE FROM "JobTask" jt1
        USING "JobTask" jt2
        WHERE jt1."jobId" = jt2."jobId"
          AND jt1."promotedFromBuildOpsTaskId" = jt2."promotedFromBuildOpsTaskId"
          AND jt1.id > jt2.id
      `,
    },
  ];

  for (const step of steps) {
    try {
      const deleted = await prisma.$executeRawUnsafe(step.sql.trim());
      if (deleted > 0) {
        console.log(`  [pre-migrate] dedup ${step.name}: ${deleted} rows removed`);
        total += deleted;
      }
    } catch (err) {
      // Table may not exist yet on first deploy — that is fine
      const msg = err instanceof Error ? err.message : String(err);
      if (/does not exist|relation .* does not exist/i.test(msg)) {
        console.log(`  [pre-migrate] skip ${step.name}: table not yet created`);
      } else {
        console.warn(`  [pre-migrate] warn ${step.name}: ${msg}`);
      }
    }
  }

  console.log(`[pre-migrate] dedup complete — ${total} total rows removed`);
  await prisma.$disconnect();
}

runDedup().catch(async (err) => {
  console.error("[pre-migrate] fatal:", err.message ?? err);
  await prisma.$disconnect().catch(() => {});
  // Don't fail the container startup — log the error and let migrate decide
});
