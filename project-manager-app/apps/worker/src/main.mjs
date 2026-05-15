// Catch errors that happen during module init (before main() is called)
process.on("uncaughtException", (err) => {
  console.error("[worker] UNCAUGHT:", err?.message ?? String(err));
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[worker] UNHANDLED REJECTION:", reason?.message ?? String(reason));
  process.exit(1);
});

import { config as dotenvConfig } from "dotenv";
import { setTimeout as sleep } from "node:timers/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import pino from "pino";
import { executeGovernedAgentRun } from "@semse/agents";
import {
  buildIdentityHeaders,
  parseRoleList,
  SEMSE_AGENT_RUN_QUEUE,
  SEMSE_BOOTSTRAP_HEADER_NAME,
  SEMSE_DEVELOPER_RUNTIME_QUEUE,
  validateWorkerEnv
} from "@semse/shared";
import { executeSpecializedWorkerRun, shouldUseSpecializedWorkerHandler } from "./agent-run-handlers.mjs";
import { executeDeveloperRuntimeJob } from "./modules/developer-runtime/runtime.executor.mjs";
import { runCurator } from "./modules/curator/curator.service.mjs";

const workerDir = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(workerDir, "..", ".env"), override: false });
dotenvConfig({ path: resolve(workerDir, "..", "..", "api", ".env"), override: false });
dotenvConfig({ path: resolve(workerDir, "..", "..", "web", ".env.local"), override: false });
if (!process.env.SEMSE_API_URL && process.env.SEMSE_API_BASE_URL) {
  process.env.SEMSE_API_URL = process.env.SEMSE_API_BASE_URL;
}

const logger = pino({ name: "semse-worker" });
const env = validateWorkerEnv(process.env);
const START_RUN_RETRY_DELAYS_MS = [150, 400, 900];
const START_STABILIZATION_DELAY_MS = 250;
const WORKER_LOCK_TTL_MS = 30_000;

const config = {
  apiBaseUrl: env.SEMSE_API_URL,
  redisUrl: env.REDIS_URL,
  bootstrapToken: env.SEMSE_BOOTSTRAP_TOKEN ?? null,
  workerId: env.SEMSE_WORKER_ID ?? `worker-local-${process.pid}`,
  tenantId: env.SEMSE_TENANT_ID,
  userId: env.SEMSE_USER_ID,
  orgId: env.SEMSE_ORG_ID,
  roles: env.SEMSE_ROLES,
  heartbeatIntervalMs: env.SEMSE_HEARTBEAT_MS,
  runDurationMs: env.SEMSE_RUN_SIM_MS,
  failRate: env.SEMSE_FAIL_RATE,
  reclaimIntervalMs: env.SEMSE_RECLAIM_MS,
  staleAfterMs: env.SEMSE_STALE_AFTER_MS,
  agentType: env.SEMSE_AGENT_TYPE ?? undefined
};

const connection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null
});

const RESERVATION_SWEEP_INTERVAL_MS = 60_000;
const CURATOR_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000; // check every 6h, curator decides if 7d passed

let shouldStop = false;
let reclaimTimer;
let reservationSweepTimer;
let curatorTimer;
let authState = {
  accessToken: null,
  refreshToken: null
};

process.on("SIGINT", () => {
  shouldStop = true;
  logger.info("received SIGINT, draining worker");
});

process.on("SIGTERM", () => {
  shouldStop = true;
  logger.info("received SIGTERM, draining worker");
});

async function acquireWorkerLock() {
  const lockKey = `semse:worker-lock:${config.workerId}`;
  const set = await connection.set(lockKey, process.pid, "PX", WORKER_LOCK_TTL_MS, "NX");
  if (!set) {
    const holder = await connection.get(lockKey);
    logger.error({ lockKey, holder }, "another worker with same workerId is already running — refusing to start");
    process.exit(1);
  }
  // Refresh lock on a short interval so it doesn't expire while we're alive
  const lockTimer = setInterval(async () => {
    await connection.pexpire(lockKey, WORKER_LOCK_TTL_MS);
  }, WORKER_LOCK_TTL_MS / 3);
  return async () => {
    clearInterval(lockTimer);
    await connection.del(lockKey);
  };
}

async function main() {
  await ensureAuthSession();
  const releaseLock = await acquireWorkerLock();

  logger.info(
    {
      workerId: config.workerId,
      apiBaseUrl: config.apiBaseUrl,
      redisUrl: config.redisUrl,
      heartbeatIntervalMs: config.heartbeatIntervalMs,
      runDurationMs: config.runDurationMs,
      reclaimIntervalMs: config.reclaimIntervalMs,
      staleAfterMs: config.staleAfterMs,
      agentType: config.agentType ?? "any",
      queue: SEMSE_AGENT_RUN_QUEUE
    },
    "worker started"
  );

  const worker = new Worker(
    SEMSE_AGENT_RUN_QUEUE,
    async (job) => {
      if (config.agentType && job.data.agentType !== config.agentType) {
        logger.info({ runId: job.data.runId, agentType: job.data.agentType }, "skipping job for different agent type");
        return { skipped: true };
      }

      return processQueuedRun(job.data);
    },
    {
      connection,
      concurrency: 2
    }
  );

  worker.on("completed", (job) => {
    logger.info({ runId: job?.data?.runId, agentType: job?.name }, "queue job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error({ runId: job?.data?.runId, agentType: job?.name, error }, "queue job failed");
  });

  const developerRuntimeWorker = new Worker(
    SEMSE_DEVELOPER_RUNTIME_QUEUE,
    async (job) => processDeveloperRuntimeQueueJob(job.data),
    {
      connection,
      concurrency: 1
    }
  );

  developerRuntimeWorker.on("completed", (job) => {
    logger.info({ sessionId: job?.data?.sessionId }, "developer runtime job completed");
  });

  developerRuntimeWorker.on("failed", (job, error) => {
    logger.error({ sessionId: job?.data?.sessionId, error }, "developer runtime job failed");
  });

  reclaimTimer = setInterval(() => {
    void reclaimStaleRuns();
  }, config.reclaimIntervalMs);

  // Sweep expired reservations and reopen jobs — runs every 60s, best-effort
  void sweepExpiredReservations();
  reservationSweepTimer = setInterval(() => {
    void sweepExpiredReservations();
  }, RESERVATION_SWEEP_INTERVAL_MS);

  // Skill curator — checks every 6h, actually runs at most once per 7 days
  void runCuratorSafe();
  curatorTimer = setInterval(() => { void runCuratorSafe(); }, CURATOR_CHECK_INTERVAL_MS);

  while (!shouldStop) {
    await sleep(250);
  }

  if (reclaimTimer) clearInterval(reclaimTimer);
  if (reservationSweepTimer) clearInterval(reservationSweepTimer);
  if (curatorTimer) clearInterval(curatorTimer);

  await worker.close();
  await developerRuntimeWorker.close();
  await releaseLock();
  await connection.quit();
  logger.info("worker stopped");
}

async function processDeveloperRuntimeQueueJob(queueRun) {
  logger.info({ sessionId: queueRun.sessionId, missionId: queueRun.missionId }, "processing developer runtime job");
  return executeDeveloperRuntimeJob({
    queueRun,
    requestJson,
    postJson,
    logger,
    workerId: config.workerId,
  });
}

async function processQueuedRun(queueRun) {
  const run = await getRunForWorker(queueRun);
  if (!run) {
    logger.warn({ runId: queueRun.runId, tenantId: queueRun.tenantId }, "queue item references missing agent run");
    return { missing: true };
  }

  logger.info({
    runId: run.id,
    agentType: run.agentType,
    queueTenantId: queueRun.tenantId,
    runTenantId: run.tenantId ?? null
  }, "processing queue job");

  await sleep(START_STABILIZATION_DELAY_MS);
  await startRunWithRetry(run, queueRun);

  let heartbeatTimer;
  try {
    heartbeatTimer = setInterval(() => {
      void heartbeatRun(run.id, run.tenantId ?? queueRun.tenantId).catch((error) => {
        if (isNonFatalHeartbeatError(error)) {
          logger.debug({ runId: run.id }, "ignoring late heartbeat after terminal run state");
          return;
        }

        logger.warn({ runId: run.id, error }, "heartbeat failed");
      });
    }, config.heartbeatIntervalMs);

    if (shouldFail()) {
      await failRun(run.id, "simulated worker failure", run.tenantId ?? queueRun.tenantId);
      return { failed: true };
    }

    const result = shouldUseSpecializedWorkerHandler(run.agentType)
      ? await executeSpecializedWorkerRun({
          run,
          workerId: config.workerId,
          requestJson,
          logger,
          tenantId: run.tenantId ?? queueRun.tenantId,
        })
      : executeGovernedAgentRun({
          agentType: run.agentType,
          runId: run.id,
          correlationId: run.correlationId,
          payload: run.input ?? {},
          environment: "worker"
        });

    await completeRun(run.id, {
      summary: result.summary,
      ...(result.result ? { result: result.result } : {}),
      ...(result.payload ? result.payload : {}),
      ...(result.actionType ? { actionType: result.actionType } : {}),
      ...(typeof result.confidence === "number" ? { confidence: result.confidence } : {}),
      ...(typeof result.requiresHumanReview === "boolean" ? { requiresHumanReview: result.requiresHumanReview } : {}),
      processedAt: new Date().toISOString(),
      workerId: config.workerId
    }, run.tenantId ?? queueRun.tenantId);

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({
      runId: run.id,
      agentType: run.agentType,
      queueTenantId: queueRun.tenantId,
      runTenantId: run.tenantId ?? null,
      error: message
    }, "queue job execution failed before terminal update");
    await failRun(run.id, message, run.tenantId ?? queueRun.tenantId);
    throw error;
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
  }
}

function shouldFail() {
  return config.failRate > 0 && Math.random() < config.failRate;
}

async function runCuratorSafe() {
  try {
    // Phase 1: LLM-based skill file review (filesystem skills)
    const result = await runCurator({ onProgress: (msg) => logger.info({ msg }, "curator") });
    if (!result.skipped) {
      logger.info({ reportDir: result.reportDir }, "curator run completed");

      // Phase 2: DB-level memory cleanup — archive stale AgentMemory + WorkspaceMemoryEntry
      try {
        const curate = await postJson("/v1/knowledge/curate", {});
        const { agentMemoriesArchived, workspaceMemoriesArchived, durationMs } = curate?.data ?? {};
        logger.info({ agentMemoriesArchived, workspaceMemoriesArchived, durationMs }, "db memory curation complete");
      } catch (dbErr) {
        logger.warn({ error: dbErr instanceof Error ? dbErr.message : String(dbErr) }, "db curation failed (non-fatal)");
      }
    }
  } catch (err) {
    logger.warn({ error: err instanceof Error ? err.message : String(err) }, "curator run failed (non-fatal)");
  }
}

async function sweepExpiredReservations() {
  try {
    const response = await postJson("/v1/reservations/sweep-expired", { maxItems: 50 });
    const { expiredCount, jobsReopened } = response?.data ?? {};
    if (expiredCount > 0) {
      logger.info({ expiredCount, jobsReopened }, "swept expired reservations");
    }
  } catch (error) {
    logger.warn({ error }, "reservation sweep failed — will retry next interval");
  }
}

async function reclaimStaleRuns() {
  try {
    const response = await postJson("/v1/agents/runs/reclaim-stale", {
      staleAfterMs: config.staleAfterMs,
      maxItems: 20
    });
    const reclaimedCount = response?.data?.reclaimedCount ?? 0;
    if (reclaimedCount > 0) {
      logger.warn({ reclaimedCount }, "reclaimed stale runs");
    }
  } catch (error) {
    logger.warn({ error }, "stale reclaim call failed");
  }
}

async function getRunForWorker(queueRun) {
  const payload = await requestJson(`/v1/agents/runs/${queueRun.runId}/worker`, {
    method: "GET"
  }, { allow404: true, tenantId: queueRun.tenantId });

  if (payload === null) {
    return null;
  }

  return payload.data;
}

async function startRunWithRetry(run, queueRun) {
  const tenantId = run.tenantId ?? queueRun.tenantId;

  for (let attempt = 0; attempt <= START_RUN_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await startRun(run.id, tenantId);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRetryableNotFound = message.includes("/start") && message.includes("HTTP 404");
      if (!isRetryableNotFound || attempt === START_RUN_RETRY_DELAYS_MS.length) {
        throw error;
      }

      const delayMs = START_RUN_RETRY_DELAYS_MS[attempt];
      logger.warn({
        runId: run.id,
        agentType: run.agentType,
        tenantId,
        attempt: attempt + 1,
        delayMs
      }, "run start returned 404, retrying after refresh");
      await sleep(delayMs);
      const refreshed = await getRunForWorker(queueRun);
      if (!refreshed) {
        throw error;
      }
      run = refreshed;
    }
  }
}

async function startRun(runId, tenantId) {
  await postJson(`/v1/agents/runs/${runId}/start`, {}, { tenantId });
}

async function heartbeatRun(runId, tenantId) {
  await postJson(`/v1/agents/runs/${runId}/heartbeat`, {
    workerId: config.workerId
  }, { tenantId });
}

async function completeRun(runId, output, tenantId) {
  await postJson(`/v1/agents/runs/${runId}/complete`, { output }, { tenantId });
}

async function failRun(runId, errorMessage, tenantId) {
  await postJson(`/v1/agents/runs/${runId}/fail`, { error: errorMessage }, { tenantId });
}

function buildHeaders() {
  return buildHeadersForTenant(config.tenantId);
}

function buildHeadersForTenant(tenantId) {
  const headers = {
    "content-type": "application/json",
    ...buildIdentityHeaders({
      userId: config.userId,
      tenantId,
      orgId: config.orgId,
      roles: parseRoleList(config.roles)
    })
  };

  if (authState.accessToken) {
    headers.authorization = `Bearer ${authState.accessToken}`;
  }

  return headers;
}

async function postJson(path, body, options = {}) {
  return requestJson(path, {
    method: "POST",
    body: JSON.stringify(body)
  }, options);
}

main().catch((error) => {
  logger.error({ error }, "fatal worker error");
  console.error("[worker] CRASH:", error?.message ?? String(error));
  if (error?.cause) console.error("[worker] CAUSE:", error.cause);
  process.exit(1);
});

function isNonFatalHeartbeatError(error) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("/heartbeat") && error.message.includes("HTTP 409");
}

async function requestJson(path, init, options = {}) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: options.tenantId ? buildHeadersForTenant(options.tenantId) : buildHeaders()
  });

  const payload = await response.json();
  if (response.status === 404 && options.allow404) {
    return null;
  }
  if (response.status === 401 && env.AUTH_SECRET) {
    await refreshAuthSession();
    const retryResponse = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers: options.tenantId ? buildHeadersForTenant(options.tenantId) : buildHeaders()
    });
    const retryPayload = await retryResponse.json();
    if (retryResponse.status === 404 && options.allow404) {
      return null;
    }
    if (!retryResponse.ok) {
      const retryMessage = retryPayload?.error?.message ?? retryPayload;
      throw new Error(`HTTP ${retryResponse.status} ${path}: ${JSON.stringify(retryMessage)}`);
    }
    return retryPayload;
  }

  if (!response.ok) {
    const message = payload?.error?.message ?? payload;
    throw new Error(`HTTP ${response.status} ${path}: ${JSON.stringify(message)}`);
  }

  return payload;
}

async function ensureAuthSession() {
  if (!env.AUTH_SECRET || authState.accessToken) {
    return;
  }

  if (!config.bootstrapToken && process.env.NODE_ENV === "production") {
    throw new Error("SEMSE_BOOTSTRAP_TOKEN is required in production");
  }

  const response = await fetch(`${config.apiBaseUrl}/v1/auth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.bootstrapToken ? { [SEMSE_BOOTSTRAP_HEADER_NAME]: config.bootstrapToken } : {})
    },
    body: JSON.stringify({
      userId: config.userId,
      tenantId: config.tenantId,
      orgId: config.orgId,
      roles: parseRoleList(config.roles),
      ttlSeconds: 3600
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message ?? payload;
    throw new Error(`HTTP ${response.status} /v1/auth/token: ${JSON.stringify(message)}`);
  }

  authState = {
    accessToken: payload.data.accessToken,
    refreshToken: payload.data.refreshToken
  };
}

async function refreshAuthSession() {
  if (!env.AUTH_SECRET) {
    return;
  }

  if (!authState.refreshToken) {
    authState = { accessToken: null, refreshToken: null };
    await ensureAuthSession();
    return;
  }

  const response = await fetch(`${config.apiBaseUrl}/v1/auth/refresh`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      refreshToken: authState.refreshToken
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    authState = { accessToken: null, refreshToken: null };
    await ensureAuthSession();
    return;
  }

  authState = {
    accessToken: payload.data.accessToken,
    refreshToken: payload.data.refreshToken
  };
}
