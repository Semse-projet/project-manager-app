import assert from "node:assert/strict";
import test from "node:test";
import { checkReadiness } from "../../apps/api/src/modules/health/readiness.logic.ts";

const previousDatabaseUrl = process.env.DATABASE_URL;
const previousRequireWorker = process.env.SEMSE_READY_REQUIRE_WORKER;

function restoreEnv(): void {
  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }

  if (previousRequireWorker === undefined) {
    delete process.env.SEMSE_READY_REQUIRE_WORKER;
  } else {
    process.env.SEMSE_READY_REQUIRE_WORKER = previousRequireWorker;
  }
}

function makePrisma(options: { failedMigrations?: number; databaseFails?: boolean } = {}) {
  return {
    async $queryRawUnsafe(query: string) {
      if (options.databaseFails && query === "SELECT 1") {
        throw new Error("database unavailable");
      }
      if (query.includes("_prisma_migrations")) {
        return [{ count: options.failedMigrations ?? 0 }];
      }
      return [{ ok: 1 }];
    }
  };
}

function makeHealth(redis: "ok" | "degraded", worker: "ok" | "degraded" = "degraded") {
  return {
    async refreshNow() {
      return {
        api: "ok" as const,
        redis,
        worker,
        checkedAt: new Date().toISOString()
      };
    }
  };
}

function makeStorage(writable = true) {
  return {
    async healthCheck() {
      return {
        provider: "local" as const,
        effectiveProvider: "local" as const,
        root: "/tmp/semse-storage",
        writable,
        detail: writable ? "Local storage root is writable" : "Storage root is not writable"
      };
    }
  };
}

test.afterEach(() => {
  restoreEnv();
});

test("readiness: reports ready when required dependencies are healthy", async () => {
  process.env.DATABASE_URL = "postgresql://semse:test@localhost:5432/semse";
  delete process.env.SEMSE_READY_REQUIRE_WORKER;

  const prisma = makePrisma();
  const health = makeHealth("ok", "degraded");
  const storage = makeStorage(true);

  const report = await checkReadiness({
    queryRawUnsafe: prisma.$queryRawUnsafe,
    refreshHealth: health.refreshNow,
    storageHealthCheck: storage.healthCheck
  });

  assert.equal(report.status, "ready");
  assert.equal(report.components.find((component) => component.name === "worker")?.required, false);
});

test("readiness: fails closed when Redis is degraded", async () => {
  process.env.DATABASE_URL = "postgresql://semse:test@localhost:5432/semse";

  const prisma = makePrisma();
  const health = makeHealth("degraded");
  const storage = makeStorage(true);

  const report = await checkReadiness({
    queryRawUnsafe: prisma.$queryRawUnsafe,
    refreshHealth: health.refreshNow,
    storageHealthCheck: storage.healthCheck
  });

  assert.equal(report.status, "not_ready");
  assert.equal(report.components.find((component) => component.name === "redis")?.state, "failed");
});

test("readiness: fails when Prisma has failed or incomplete migrations", async () => {
  process.env.DATABASE_URL = "postgresql://semse:test@localhost:5432/semse";

  const prisma = makePrisma({ failedMigrations: 1 });
  const health = makeHealth("ok");
  const storage = makeStorage(true);

  const report = await checkReadiness({
    queryRawUnsafe: prisma.$queryRawUnsafe,
    refreshHealth: health.refreshNow,
    storageHealthCheck: storage.healthCheck
  });

  assert.equal(report.status, "not_ready");
  assert.match(report.components.find((component) => component.name === "migrations")?.detail ?? "", /migration/i);
});

test("readiness: can require worker heartbeat by environment flag", async () => {
  process.env.DATABASE_URL = "postgresql://semse:test@localhost:5432/semse";
  process.env.SEMSE_READY_REQUIRE_WORKER = "true";

  const prisma = makePrisma();
  const health = makeHealth("ok", "degraded");
  const storage = makeStorage(true);

  const report = await checkReadiness({
    queryRawUnsafe: prisma.$queryRawUnsafe,
    refreshHealth: health.refreshNow,
    storageHealthCheck: storage.healthCheck
  });

  assert.equal(report.status, "not_ready");
  assert.equal(report.components.find((component) => component.name === "worker")?.required, true);
});
