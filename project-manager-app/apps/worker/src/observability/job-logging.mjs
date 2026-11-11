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
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.constructor.name : "Unknown"
        });
        throw error;
      }
    }, jobContext)
  );
}

/**
 * Pino serializa un `Error` dentro de una clave arbitraria (`{ error }`) como
 * `{}`, así que los fallos de los barridos periódicos (reclaim, reservas,
 * contributors…) quedaban en los logs como "failed" sin motivo. Devuelve un
 * objeto plano y seguro: mensaje, tipo y, si el mensaje sigue el formato de
 * `requestJson` (`HTTP <status> <path>: …`), el código HTTP y la ruta. No
 * incluye stack ni cuerpo de la petición.
 */
export function describeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const details = {
    message: message.length > 500 ? `${message.slice(0, 500)}…` : message,
    type: error instanceof Error ? error.constructor.name : typeof error,
  };
  const http = /^HTTP (\d{3}) (\S+?):/.exec(message);
  if (http) {
    details.httpStatus = Number(http[1]);
    details.path = http[2];
  }
  const causeCode = error instanceof Error ? error.cause?.code : undefined;
  if (typeof causeCode === "string") details.causeCode = causeCode;
  return details;
}
