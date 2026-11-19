/**
 * Instrumentación de jobs BullMQ con el SEMSELogger compartido (@semse/shared).
 *
 * Cada job obtiene su propio logger (`service: "semse-worker"`, `runId: job.id`)
 * y un traceId propagado desde la API vía `job.data.traceId`. El traceId queda
 * en un AsyncLocalStorage para que las llamadas HTTP salientes lo reenvíen
 * en el header `x-trace-id`.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { createLogger } from "@semse/shared";

const WORKER_SERVICE = "semse-worker";
const traceStorage = new AsyncLocalStorage();

export function getCurrentTraceId() {
  return traceStorage.getStore()?.traceId;
}

export function runWithTraceId(traceId, fn) {
  return traceStorage.run({ traceId }, fn);
}

export function resolveJobTraceId(job) {
  const candidate = job?.data?.traceId;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : randomUUID();
}

export function createJobLogger(job) {
  return createLogger(WORKER_SERVICE, {
    runId: job?.id ? String(job.id) : randomUUID(),
    traceId: resolveJobTraceId(job)
  });
}

/**
 * Ejecuta el procesamiento de un job dentro de un span `process_job`, emitiendo
 * `info` al iniciar y completar y `error` en fallos.
 */
export async function processJobWithLogging({ job, queue, data = {}, handler }) {
  const logger = createJobLogger(job);
  const jobContext = { queue, jobId: job?.id ?? null, jobName: job?.name ?? null, ...data };

  return runWithTraceId(logger.traceId, () =>
    logger.withSpan("process_job", async () => {
      logger.info("job started", jobContext);
      try {
        const result = await handler({ logger, traceId: logger.traceId });
        logger.info("job completed", jobContext);
        return result;
      } catch (error) {
        logger.error("job failed", {
          ...jobContext,
          error: describeError(error),
          errorType: error instanceof Error ? error.constructor.name : "Unknown"
        });
        throw error;
      }
    }, jobContext)
  );
}

/**
 * Pino turns Error under a nonstandard key (`{ error }`) into `{}`.
 * Return only non-sensitive diagnostics. In particular requestJson errors
 * contain the entire upstream response body in Error.message: never log it.
 */
export function describeError(error) {
  const raw = error instanceof Error ? error.message : String(error);
  const type = error instanceof Error ? error.constructor.name : typeof error;
  const http = /^HTTP ([1-5]\d{2}) (\/[^\s:]*):/.exec(raw);
  let details;
  if (http) {
    const httpStatus = Number(http[1]);
    // Remove query strings/fragments; reject unexpected characters and long paths.
    const candidate = http[2].split(/[?#]/, 1)[0];
    const path = /^\/[A-Za-z0-9/_-]{1,160}$/.test(candidate) ? candidate : "[redacted]";
    details = {
      message: `HTTP ${httpStatus} ${path} (response omitted)`,
      type,
      httpStatus,
      path
    };
  } else {
    // Only known, fixed network error texts are safe to preserve verbatim.
    const knownNetworkError = /^(fetch failed|request timed out|network timeout)$/i.test(raw);
    details = { message: knownNetworkError ? raw : "Error details omitted", type };
  }
  const code = error instanceof Error ? error.cause?.code : undefined;
  if (typeof code === "string" && /^[A-Z][A-Z0-9_]{1,35}$/.test(code)) {
    details.causeCode = code;
  }
  return details;
}
