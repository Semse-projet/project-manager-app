#!/usr/bin/env node
/**
 * Migraciones de arranque — se ejecuta antes de levantar la API.
 * 1. Solo si la base NO tiene historial de migraciones (escenario P3005): crea
 *    _prisma_migrations, marca las migraciones existentes como aplicadas via
 *    SQL directo + checksums, y sincroniza con prisma db push. Si SI hay
 *    historial no se baseliza nada: las no registradas son pendientes.
 * 2. Deduplica filas que violarian constraints unicos.
 * 3. Aplica las migraciones pendientes con prisma migrate deploy.
 *
 * El paso 3 es la unica via por la que el SQL de una migracion se ejecuta en
 * produccion. Antes no existia, y el paso 1 marcaba como aplicada cualquier
 * migracion nueva, asi que ningun backfill ni limpieza de datos llegaba a
 * correr — ni en el arranque ni despues a mano.
 *
 * Uses require.resolve("prisma/build/index.js") for the Prisma CLI so it works
 * regardless of symlink state or package manager (npm/pnpm).
 * Exits 1 on baseline failure so the container fails visibly.
 */
import prismaClientPkg from "@prisma/client";
const { PrismaClient } = prismaClientPkg;
import { execFileSync } from "child_process";
import { createHash, randomUUID } from "crypto";
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SCHEMA = join(ROOT, "packages/db/prisma/schema.prisma");
const MIGRATIONS_DIR = join(ROOT, "packages/db/prisma/migrations");

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Prisma CLI — resolve actual module path, bypass symlink issues
// ---------------------------------------------------------------------------

function getPrismaCli() {
  try {
    const req = createRequire(import.meta.url);
    const cli = req.resolve("prisma/build/index.js");
    return { file: process.execPath, baseArgs: [cli] };
  } catch {
    // Fallback to PATH binary
    return { file: "prisma", baseArgs: [] };
  }
}

function run(file, args) {
  console.log(`  [pre-migrate] $ ${[file, ...args].join(" ").replaceAll(ROOT, ".")}`);
  execFileSync(file, args, { stdio: "inherit", cwd: ROOT });
}

// ---------------------------------------------------------------------------
// P3005 baseline
// ---------------------------------------------------------------------------

async function baselineIfNeeded() {
  // Step 1: ensure _prisma_migrations table exists
  const [row] = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = '_prisma_migrations'
    ) AS exists
  `;

  if (!row.exists) {
    console.log("[pre-migrate] ⚠ _prisma_migrations missing — creating table");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id"                  VARCHAR(36)  NOT NULL PRIMARY KEY,
        "checksum"            VARCHAR(64)  NOT NULL,
        "finished_at"         TIMESTAMPTZ,
        "migration_name"      VARCHAR(255) NOT NULL,
        "logs"                TEXT,
        "rolled_back_at"      TIMESTAMPTZ,
        "started_at"          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "applied_steps_count" INTEGER      NOT NULL DEFAULT 0
      )
    `);
  }

  // Step 2: find migration files on disk
  const diskMigrations = readdirSync(MIGRATIONS_DIR)
    .filter((d) => statSync(join(MIGRATIONS_DIR, d)).isDirectory())
    .sort();

  // Step 3: find which migrations are already recorded in the DB
  const dbRows = await prisma.$queryRaw`
    SELECT migration_name FROM "_prisma_migrations"
  `;
  const recorded = new Set(dbRows.map((r) => r.migration_name));

  // El baseline existe para UN solo escenario: una base que ya tiene tablas
  // pero ningun historial de migraciones (P3005). Si hay historial, cualquier
  // migracion no registrada es simplemente una migracion pendiente, y aplicarla
  // es trabajo de `migrate deploy`.
  //
  // Marcarlas aqui como aplicadas -lo que se hacia antes- las saltaba para
  // siempre: su SQL no se ejecutaba nunca, ni en el arranque ni despues a mano,
  // porque `migrate deploy` ya las veia registradas. La base quedaba
  // desincronizada del esquema en silencio.
  // Una base vacia no es el escenario P3005: ahi lo correcto es que
  // `migrate deploy` construya el esquema aplicando las migraciones en orden.
  // Baselizarla marcaria todo como aplicado sin ejecutar nada.
  const [{ count: userTables }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (userTables === 0) {
    console.log("[pre-migrate] base vacia — migrate deploy creara el esquema desde cero");
    return;
  }

  const hasHistory = row.exists && recorded.size > 0;
  if (hasHistory) {
    const pending = diskMigrations.filter(
      (name) => !recorded.has(name) && existsSync(join(MIGRATIONS_DIR, name, "migration.sql")),
    );
    if (pending.length > 0) {
      console.log(
        `[pre-migrate] ${pending.length} migracion(es) pendiente(s) — las aplicara migrate deploy: ${pending.join(", ")}`,
      );
    } else {
      console.log("[pre-migrate] _prisma_migrations complete — no baseline needed");
    }
    return;
  }

  console.log("[pre-migrate] ⚠ base sin historial de migraciones (P3005) — baseline");

  const missing = diskMigrations.filter(
    (name) => !recorded.has(name) && existsSync(join(MIGRATIONS_DIR, name, "migration.sql"))
  );

  if (missing.length > 0) {
    console.log(`[pre-migrate] ⚠ ${missing.length} migration(s) not recorded — inserting`);
    const now = new Date().toISOString();

    for (const name of missing) {
      const sql = readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf-8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const id = randomUUID();

      await prisma.$executeRawUnsafe(`
        INSERT INTO "_prisma_migrations"
          (id, checksum, finished_at, migration_name, applied_steps_count, started_at)
        VALUES
          ('${id}', '${checksum}', '${now}', '${name}', 1, '${now}')
      `);

      console.log(`  [pre-migrate] baseline: ${name}`);
    }
  }

  // Step 4: db push to add any tables/columns missing from DB
  //         (safe for additive changes; non-fatal if destructive drift exists)
  const prismaCli = getPrismaCli();
  try {
    run(prismaCli.file, [
      ...prismaCli.baseArgs,
      "db", "push",
      "--schema", SCHEMA,
      "--skip-generate",
      "--accept-data-loss=false",
    ]);
    console.log("[pre-migrate] ✓ db push complete");
  } catch {
    console.warn("[pre-migrate] db push skipped (non-fatal — destructive change detected or binary unavailable)");
  }

  console.log("[pre-migrate] ✓ Baseline complete — migrate deploy will be a no-op");
}

// ---------------------------------------------------------------------------
// Dedup rows that would block unique-constraint migrations
// ---------------------------------------------------------------------------

async function runDedup() {
  let total = 0;

  const steps = [
    {
      name: "BuildOpsProject (same jobId)",
      sql: `DELETE FROM "BuildOpsProject" b1 USING "BuildOpsProject" b2
            WHERE b1."jobId" = b2."jobId" AND b1.id > b2.id`,
    },
    {
      name: "BuildOpsTask (same projectId+templateKey)",
      sql: `DELETE FROM "BuildOpsTask" t1 USING "BuildOpsTask" t2
            WHERE t1."projectId" = t2."projectId"
              AND t1."templateKey" = t2."templateKey"
              AND t1.id > t2.id`,
    },
    {
      name: "Milestone (same projectId+sequence, not deleted)",
      sql: `DELETE FROM "Milestone" m1 USING "Milestone" m2
            WHERE m1."projectId" = m2."projectId"
              AND m1."sequence" = m2."sequence"
              AND m1."deletedAt" IS NULL AND m2."deletedAt" IS NULL
              AND m1.id > m2.id`,
    },
    {
      name: "Project (same promotedFromBuildOpsProjectId)",
      sql: `DELETE FROM "Project" p1 USING "Project" p2
            WHERE p1."promotedFromBuildOpsProjectId" = p2."promotedFromBuildOpsProjectId"
              AND p1."promotedFromBuildOpsProjectId" IS NOT NULL
              AND p1.id > p2.id`,
    },
    {
      name: "JobTask (same jobId+promotedFromBuildOpsTaskId)",
      sql: `DELETE FROM "JobTask" jt1 USING "JobTask" jt2
            WHERE jt1."jobId" = jt2."jobId"
              AND jt1."promotedFromBuildOpsTaskId" = jt2."promotedFromBuildOpsTaskId"
              AND jt1.id > jt2.id`,
    },
  ];

  for (const step of steps) {
    try {
      const deleted = await prisma.$executeRawUnsafe(step.sql);
      if (deleted > 0) {
        console.log(`  [pre-migrate] dedup ${step.name}: ${deleted} rows removed`);
        total += deleted;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/does not exist|relation .* does not exist/i.test(msg)) {
        // Table not yet created — normal on first deploy
      } else {
        console.warn(`  [pre-migrate] warn dedup ${step.name}: ${msg}`);
      }
    }
  }

  console.log(`[pre-migrate] dedup complete — ${total} rows removed`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Hard timeout: if pre-migrate hangs >25s (DB unreachable), fail fast
const PREMIGRATE_TIMEOUT = 25_000;
const hangTimer = setTimeout(() => {
  console.error("[pre-migrate] FATAL: timed out after 25s — DB may be unreachable");
  process.exit(1);
}, PREMIGRATE_TIMEOUT);

try {
  await baselineIfNeeded();
} catch (err) {
  clearTimeout(hangTimer);
  console.error("[pre-migrate] FATAL: baseline failed:", err?.message ?? err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1); // Fail loudly — do not proceed to migrate deploy
}
clearTimeout(hangTimer);

try {
  await runDedup();
} catch (err) {
  console.warn("[pre-migrate] warn: dedup error:", err?.message ?? err);
}

// ---------------------------------------------------------------------------
// Aplicar migraciones pendientes
// ---------------------------------------------------------------------------
//
// Va DESPUES del dedup, que existe precisamente para limpiar filas que
// impedirian crear un constraint unico.
//
// Si esto falla, se sale con codigo 1 y el contenedor no arranca: es
// deliberado. Arrancar la API con un cliente Prisma que conoce columnas que la
// base no tiene es peor que no arrancar, porque el fallo aparece disperso en
// tiempo de ejecucion en vez de una sola vez en el arranque.
try {
  const prismaCli = getPrismaCli();
  console.log("[pre-migrate] aplicando migraciones pendientes...");
  run(prismaCli.file, [...prismaCli.baseArgs, "migrate", "deploy", "--schema", SCHEMA]);
  console.log("[pre-migrate] ✓ migrate deploy completo");
} catch (err) {
  console.error("[pre-migrate] FATAL: migrate deploy fallo:", err?.message ?? err);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
}

// Force exit — prisma.$disconnect() can hang keeping the process alive,
// which prevents the && chain from starting node apps/api/dist/main.js
prisma.$disconnect().catch(() => {});
process.exit(0);
