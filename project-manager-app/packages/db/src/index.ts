import path from "node:path";
import { fileURLToPath } from "node:url";
import prismaClientPackage from "../../../node_modules/.prisma/client/index.js";
import { config as loadEnv } from "dotenv";

const { PrismaClient } = prismaClientPackage as typeof import("../../../node_modules/.prisma/client/index.js");

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(packageDir, "../.env");

if (!process.env.DATABASE_URL) {
  loadEnv({ path: envFile });
}

declare global {
  // Reuse the same Prisma client during local dev reloads.
  // eslint-disable-next-line no-var
  var __semsePrisma__: InstanceType<typeof PrismaClient> | undefined;
}

export const prisma =
  globalThis.__semsePrisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__semsePrisma__ = prisma;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export { PrismaClient };
