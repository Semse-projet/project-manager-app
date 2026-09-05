#!/usr/bin/env node
/**
 * Railway production migration gate.
 *
 * Runs reviewed Prisma migrations exactly once in Railway's pre-deploy phase.
 * It never rewrites migration history, synchronizes schema implicitly, or
 * repairs application data. Any migration error exits non-zero so Railway
 * keeps the previous deployment active.
 */
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, "..");
const schema = join(root, "packages", "db", "prisma", "schema.prisma");

function resolvePrismaCli() {
  const require = createRequire(import.meta.url);
  const cli = require.resolve("prisma/build/index.js");
  return { executable: process.execPath, args: [cli] };
}

try {
  const prisma = resolvePrismaCli();
  console.log("[pre-migrate] applying reviewed Prisma migrations");
  execFileSync(
    prisma.executable,
    [...prisma.args, "migrate", "deploy", "--schema", schema],
    {
      cwd: root,
      stdio: "inherit",
      timeout: 120_000,
    },
  );
  console.log("[pre-migrate] migrations applied successfully");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[pre-migrate] FATAL: ${message}`);
  process.exitCode = 1;
}
