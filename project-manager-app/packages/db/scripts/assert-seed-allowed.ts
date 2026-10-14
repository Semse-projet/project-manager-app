/**
 * Paso previo de `prisma:reset`: `prisma migrate reset --force` borra la base ANTES de que corra el
 * seed, así que el guard del seed llegaría tarde. Termina con código 1 si el entorno no es seguro.
 */
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSeedAllowed } from "../prisma/seed-guard.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../../../apps/api/.env") });

try {
  assertSeedAllowed(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Seed demo rechazado.");
  process.exit(1);
}
