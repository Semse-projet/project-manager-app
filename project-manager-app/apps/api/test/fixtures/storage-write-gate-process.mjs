/**
 * T-008 test-only child process. Not a server entrypoint.
 * Parent must authorize a disposable CI DB and a synthetic tmp root.
 */
import "reflect-metadata";
import { Readable } from "node:stream";
import { PrismaClient } from "@prisma/client";
import { StorageWriteGateCoordinator } from "../../dist/infrastructure/storage/storage-write-gate-coordinator.js";
import { StorageWriteOperationBoundary } from "../../dist/infrastructure/storage/storage-write-operation-boundary.js";
import { StorageService } from "../../dist/infrastructure/storage/storage.service.js";

const { DATABASE_URL = "", SEMSE_STORAGE_ROOT = "", T008_WORKER_MODE = "" } = process.env;
const safe = (() => {
  try {
    const db = new URL(DATABASE_URL);
    return process.env.CI === "true" &&
      db.protocol === "postgresql:" &&
      db.hostname === "127.0.0.1" &&
      db.port === "5433" &&
      db.pathname === "/semse" &&
      db.username === "semse" &&
      SEMSE_STORAGE_ROOT.startsWith("/tmp/semse-t008-process-") &&
      process.env.NODE_ENV === "test" &&
      process.env.SEMSE_STORAGE_WRITE_GATE_MODE === "staging" &&
      !process.env.RAILWAY_ENVIRONMENT &&
      !process.env.RAILWAY_ENVIRONMENT_NAME;
  } catch { return false; }
})();
if (!safe || !process.send || !["slow", "quick"].includes(T008_WORKER_MODE)) {
  throw new Error("T-008 child requires disposable CI PostgreSQL, temporary root and IPC");
}

const db = new PrismaClient();
const gate = new StorageWriteGateCoordinator(db);
const storage = new StorageService(new StorageWriteOperationBoundary(gate));
const key = process.env.T008_WORKER_KEY;
if (!key?.startsWith("tenants/ci-tenant/public-intake/evidence/t008-")) {
  throw new Error("Invalid synthetic worker storage key");
}
const send = (message) => new Promise((resolve) => process.send(message, resolve));

async function* chunks() {
  yield Buffer.from("synthetic-before-");
  if (T008_WORKER_MODE === "slow") {
    await send({type: "paused", pid: process.pid});
    await new Promise((resolve) => {
      process.on("message", (message) => {
        if (message?.type === "resume") resolve();
      });
    });
  }
  yield Buffer.from("after");
}

try {
  const result = await storage.store({
    key,
    contentType: "text/plain",
    stream: Readable.from(chunks()),
  });
  await db.$disconnect();
  await send({type: "stored", sizeBytes: result.sizeBytes, key});
  process.exit(0);
} catch (error) {
  const status = typeof error?.getStatus === "function" ? error.getStatus() : null;
  await db.$disconnect().catch(() => undefined);
  await send({type: "rejected", status, name: error?.name ?? "Error"});
  process.exit(status === 503 ? 0 : 1);
}
