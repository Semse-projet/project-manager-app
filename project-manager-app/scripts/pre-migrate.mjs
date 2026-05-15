#!/usr/bin/env node
/**
 * Pre-migration script — runs BEFORE prisma migrate deploy.
 * 1. Deduplicates rows that would violate unique constraints.
 * 2. If the DB has no migration history (P3005 scenario), baselines all
 *    migrations so the subsequent migrate deploy is a no-op.
 */
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd) {
  console.log(`  [pre-migrate] $ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: resolve(__dirname, "..") });
}

// ---------------------------------------------------------------------------
// P3005 baseline — marks all existing migrations as applied without running
// them, then db-pushes to add any tables that exist in schema but not in DB.
// ---------------------------------------------------------------------------

async function baselineIfNeeded() {
  // Check whether _prisma_migrations already exists
  const [row] = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = '_prisma_migrations'
    ) AS exists
  `;
  if (row.exists) return; // migration history is present — nothing to do

  console.log(
    "[pre-migrate] _prisma_migrations not found. Baselining DB schema..."
  );

  const SCHEMA = "packages/db/prisma/schema.prisma";
  const PRISMA = "./node_modules/.bin/prisma";

  // Sync schema (adds tables that are in schema.prisma but not in DB yet)
  run(`${PRISMA} db push --schema ${SCHEMA} --skip-generate --accept-data-loss=false`);

  const MIGRATIONS = [
    "20260309205333_init",
    "20260310045500_dispute_assignment_fields",
    "20260310052000_agent_run_lifecycle_fields",
    "20260312160000_job_reservations_contracts_transition",
    "20260312190000_payment_escrow_job_contract_link",
    "20260313183000_bid_professional_user_bridge",
    "20260408133000_soft_delete_and_runtime_indexes",
    "20260408183000_agent_approval_persistence",
    "20260409160000_tracker_sessions",
    "20260409195000_autonomous_pr_runs",
    "20260416021500_workspace_memory_entries",
    "20260419000000_agent_run_idempotency",
    "20260419000100_workspace_memory_fts_index",
    "20260419001000_tasks_incidents_materials",
    "20260422000000_travel_ops",
    "20260422010000_travel_google_places",
    "20260423010000_developer_runtime_persistence",
    "20260424000000_user_profile",
    "20260424010000_agent_work_plan",
    "20260424020000_agent_memory",
    "20260424030000_agent_work_plan_meta",
    "20260425000000_agent_delegation",
    "20260425010000_user_profile_assistant_prefs",
    "20260427000000_prometeo_engine",
    "20260428000000_ai_models_logging",
    "20260428010000_ai_interaction_thread_id",
    "20260504235951_sync_schema_drift",
    "20260505000000_buildops_projects",
    "20260506000000_buildops_tasks",
    "20260511000000_project_intake",
    "20260511020000_intake_operations_bridge",
    "20260512100000_buildops_client_approval",
    "20260512110000_security_hardening",
    "20260512143000_buildops_legacy_promotion_trace",
    "20260512170000_buildops_plan_versions",
    "20260514000000_algorithm_run_milestone_evidence",
    "20260514010000_change_order_candidate",
  ];

  for (const m of MIGRATIONS) {
    try {
      run(`${PRISMA} migrate resolve --schema ${SCHEMA} --applied ${m}`);
    } catch {
      // Already marked applied — safe to ignore
    }
  }

  console.log("[pre-migrate] ✓ Baseline complete. migrate deploy will be a no-op.");
}

// ---------------------------------------------------------------------------
// Dedup rows that would block unique-constraint migrations
// ---------------------------------------------------------------------------

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
      const msg = err instanceof Error ? err.message : String(err);
      if (/does not exist|relation .* does not exist/i.test(msg)) {
        console.log(`  [pre-migrate] skip ${step.name}: table not yet created`);
      } else {
        console.warn(`  [pre-migrate] warn ${step.name}: ${msg}`);
      }
    }
  }

  console.log(`[pre-migrate] dedup complete — ${total} total rows removed`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await baselineIfNeeded();
  await runDedup();
}

main()
  .catch(async (err) => {
    console.error("[pre-migrate] fatal:", err.message ?? err);
    await prisma.$disconnect().catch(() => {});
    // Don't fail container startup — let migrate decide
  })
  .finally(() => prisma.$disconnect().catch(() => {}));
