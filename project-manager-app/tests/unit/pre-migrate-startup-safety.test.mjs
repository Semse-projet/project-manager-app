import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import prismaClientPkg from "@prisma/client";

const { PrismaClient } = prismaClientPkg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const PRE_MIGRATE_SCRIPT = resolve(ROOT, "scripts/pre-migrate.mjs");

// Golden regression: migration/startup safety.
//
// Reproduces the exact production incident state (P3009): a row in
// _prisma_migrations with finished_at IS NULL and rolled_back_at IS NULL —
// i.e. a migration that started but never finished. scripts/pre-migrate.mjs
// is what gates the API container's boot; it must fail loudly (non-zero
// exit, clear FATAL log) instead of proceeding to start the API against a
// schema it cannot guarantee, or silently ignoring the stuck migration.
test(
  "pre-migrate.mjs fails loudly (non-zero exit) instead of booting past a stuck (P3009) migration",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL (postgres service) — see .github/workflows/ci.yml" },
  async () => {
    const prisma = new PrismaClient();
    const syntheticId = randomUUID();
    const syntheticName = `99999999999999_golden_regression_stuck_migration_${Date.now()}`;

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations"
           (id, checksum, migration_name, applied_steps_count, started_at, finished_at, rolled_back_at)
         VALUES ($1, $2, $3, 0, now(), NULL, NULL)`,
        syntheticId,
        "0".repeat(64),
        syntheticName,
      );

      const result = spawnSync(process.execPath, [PRE_MIGRATE_SCRIPT], {
        cwd: ROOT,
        env: process.env,
        encoding: "utf-8",
      });

      const combinedOutput = `${result.stdout ?? ""}${result.stderr ?? ""}`;

      assert.notEqual(
        result.status,
        0,
        `pre-migrate.mjs must exit non-zero when a migration is stuck unfinished (P3009); ` +
          `got exit ${result.status}. Output:\n${combinedOutput}`,
      );
      assert.match(
        combinedOutput,
        /FATAL/i,
        "pre-migrate.mjs must log a clear FATAL failure, not fail silently",
      );
      assert.doesNotMatch(
        combinedOutput,
        /migrate deploy completo/,
        "pre-migrate.mjs must not report a successful deploy while a migration is stuck unfinished",
      );
    } finally {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "_prisma_migrations" WHERE id = $1`,
        syntheticId,
      );
      await prisma.$disconnect();
    }
  },
);
