import type { StorageHealthStatus } from "../../infrastructure/storage/storage.service.js";
import type { SystemHealthStatus } from "./health.service.js";

export type ReadinessComponentName = "database" | "migrations" | "redis" | "worker" | "storage";
export type ReadinessComponentState = "ok" | "degraded" | "failed";

export type ReadinessComponent = {
  name: ReadinessComponentName;
  state: ReadinessComponentState;
  required: boolean;
  latencyMs: number;
  detail: string;
};

export type ReadinessReport = {
  status: "ready" | "not_ready";
  checkedAt: string;
  components: ReadinessComponent[];
};

export type ReadinessDependencies = {
  queryRawUnsafe: <T = unknown>(query: string) => Promise<T>;
  refreshHealth: () => Promise<SystemHealthStatus>;
  storageHealthCheck: () => Promise<StorageHealthStatus>;
  databaseEnabled?: () => boolean;
  timeoutMs?: number;
  requireWorker?: boolean;
  now?: () => Date;
};

const DEFAULT_CHECK_TIMEOUT_MS = 2_000;

function defaultDatabaseEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function readinessTimeoutMs(): number {
  const parsed = Number(process.env.SEMSE_READY_TIMEOUT_MS ?? DEFAULT_CHECK_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHECK_TIMEOUT_MS;
}

export function readinessRequireWorker(): boolean {
  return (process.env.SEMSE_READY_REQUIRE_WORKER ?? "false").toLowerCase() === "true";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function normalizeCount(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function failed(
  name: ReadinessComponentName,
  required: boolean,
  latencyMs: number,
  error: unknown
): ReadinessComponent {
  return {
    name,
    state: "failed",
    required,
    latencyMs,
    detail: error instanceof Error ? error.message : String(error)
  };
}

async function measure(
  name: ReadinessComponentName,
  required: boolean,
  check: () => Promise<string>
): Promise<ReadinessComponent> {
  const startedAt = Date.now();
  try {
    return {
      name,
      state: "ok",
      required,
      latencyMs: Date.now() - startedAt,
      detail: await check()
    };
  } catch (error) {
    return failed(name, required, Date.now() - startedAt, error);
  }
}

async function checkDatabase(deps: ReadinessDependencies): Promise<ReadinessComponent> {
  const isDatabaseEnabled = deps.databaseEnabled ?? defaultDatabaseEnabled;
  if (!isDatabaseEnabled()) {
    return failed("database", true, 0, "DATABASE_URL is not configured");
  }

  return measure("database", true, async () => {
    await withTimeout(
      deps.queryRawUnsafe("SELECT 1"),
      deps.timeoutMs ?? readinessTimeoutMs(),
      "database readiness check"
    );
    return "Prisma query succeeded";
  });
}

async function checkMigrations(deps: ReadinessDependencies): Promise<ReadinessComponent> {
  const isDatabaseEnabled = deps.databaseEnabled ?? defaultDatabaseEnabled;
  if (!isDatabaseEnabled()) {
    return failed("migrations", true, 0, "DATABASE_URL is not configured");
  }

  return measure("migrations", true, async () => {
    const rows = await withTimeout(
      deps.queryRawUnsafe<Array<Record<string, unknown>>>(
        'SELECT COUNT(*) AS count FROM "_prisma_migrations" WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL'
      ),
      deps.timeoutMs ?? readinessTimeoutMs(),
      "migration readiness check"
    );
    const failedOrIncomplete = normalizeCount(rows[0]?.count ?? rows[0]?.COUNT);
    if (failedOrIncomplete > 0) {
      throw new Error(`${failedOrIncomplete} failed or incomplete Prisma migration(s)`);
    }
    return "No failed or incomplete Prisma migrations";
  });
}

async function checkRedisAndWorker(deps: ReadinessDependencies): Promise<{ redis: ReadinessComponent; worker: ReadinessComponent }> {
  const startedAt = Date.now();
  const workerRequired = deps.requireWorker ?? readinessRequireWorker();

  try {
    const health = await withTimeout(
      deps.refreshHealth(),
      deps.timeoutMs ?? readinessTimeoutMs(),
      "redis and worker readiness check"
    );
    const latencyMs = Date.now() - startedAt;

    return {
      redis: {
        name: "redis",
        state: health.redis === "ok" ? "ok" : "failed",
        required: true,
        latencyMs,
        detail: `Redis is ${health.redis}`
      },
      worker: {
        name: "worker",
        state: health.worker === "ok" ? "ok" : "degraded",
        required: workerRequired,
        latencyMs,
        detail: workerRequired
          ? `Worker heartbeat is required and currently ${health.worker}`
          : `Worker heartbeat is ${health.worker}; advisory for API readiness`
      }
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    return {
      redis: failed("redis", true, latencyMs, error),
      worker: failed("worker", workerRequired, latencyMs, error)
    };
  }
}

async function checkStorage(deps: ReadinessDependencies): Promise<ReadinessComponent> {
  return measure("storage", true, async () => {
    const result = await withTimeout(
      deps.storageHealthCheck(),
      deps.timeoutMs ?? readinessTimeoutMs(),
      "storage readiness check"
    );
    if (!result.writable) {
      throw new Error(result.detail);
    }
    return `${result.detail} (${result.effectiveProvider}:${result.root})`;
  });
}

export async function checkReadiness(deps: ReadinessDependencies): Promise<ReadinessReport> {
  const [database, migrations, redisAndWorker, storage] = await Promise.all([
    checkDatabase(deps),
    checkMigrations(deps),
    checkRedisAndWorker(deps),
    checkStorage(deps)
  ]);
  const components = [
    database,
    migrations,
    redisAndWorker.redis,
    redisAndWorker.worker,
    storage
  ];
  const failedRequired = components.some((component) => component.required && component.state !== "ok");

  return {
    status: failedRequired ? "not_ready" : "ready",
    checkedAt: (deps.now?.() ?? new Date()).toISOString(),
    components
  };
}
