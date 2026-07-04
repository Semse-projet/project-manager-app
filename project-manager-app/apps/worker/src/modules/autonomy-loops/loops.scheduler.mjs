/**
 * SPEC-AUT-001 (bloque AUT-001-A) — scheduler de Permanent Loops.
 *
 * Cola BullMQ dedicada `autonomy-loops` con repeatable jobs (cron por loop).
 * Reglas duras:
 *   - Kill switch global: AUTONOMY_LOOPS_ENABLED !== "true" → no se programa nada.
 *   - Pausa por loop: se consulta a la API al inicio Y entre etapas del ciclo
 *     (un ciclo en curso se detiene en <30s).
 *   - Backpressure humano y memoria de rechazos: puertos respaldados por la
 *     API (/v1/ops/loops/*) — el estado vive en Postgres, no en el worker.
 *   - Si la API no responde, el ciclo se salta (fail-closed) y se reintenta
 *     en el siguiente cron.
 */
import { Queue, Worker } from "bullmq";
import {
  AUTONOMY_LOOPS_QUEUE,
  getLoopDefinition,
  permanentLoops,
  runPermanentLoopCycle
} from "@semse/autonomy";

export function loopsEnabled(env = process.env) {
  return env.AUTONOMY_LOOPS_ENABLED === "true";
}

export async function runLoopCycleJob({ loopId, logger, requestJson, postJson, repoRoot }) {
  const definition = getLoopDefinition(loopId);
  if (!definition) {
    logger.warn({ loopId }, "unknown permanent loop — skipping");
    return { skipped: true, reason: "unknown_loop" };
  }

  // Estado remoto al inicio del ciclo. API caída → fail-closed (skip).
  let rejectedTargets;
  let openProposals;
  try {
    const rejectedRes = await requestJson(`/v1/ops/loops/${loopId}/rejected-targets`, { method: "GET" });
    rejectedTargets = rejectedRes?.data?.targets ?? [];
    const openRes = await requestJson(`/v1/ops/loops/${loopId}/open-proposals`, { method: "GET" });
    openProposals = openRes?.data?.openProposals ?? 0;
  } catch (error) {
    logger.warn({ loopId, error: error instanceof Error ? error.message : String(error) },
      "loop state unavailable from API — skipping cycle (fail-closed)");
    return { skipped: true, reason: "api_unavailable" };
  }

  const report = await runPermanentLoopCycle(definition, {
    control: {
      isEnabled: () => loopsEnabled(),
      // Re-fetch en cada consulta: el runner comprueba pausa entre etapas,
      // así el kill switch admin detiene un ciclo en curso en <30s.
      isPaused: async () => {
        try {
          const res = await requestJson(`/v1/ops/loops/${loopId}/rejected-targets`, { method: "GET" });
          return res?.data?.paused ?? false;
        } catch {
          return true; // API caída mid-cycle → fail-closed
        }
      },
      openProposalCount: () => openProposals
    },
    memory: {
      recentlyRejectedTargets: () => rejectedTargets
    },
    repoRoot
  });

  try {
    await postJson(`/v1/ops/loops/${loopId}/cycle-report`, report);
  } catch (error) {
    logger.warn({ loopId, error: error instanceof Error ? error.message : String(error) },
      "cycle report could not be persisted — findings lost this cycle");
  }

  logger.info({
    loopId,
    status: report.status,
    findings: report.findings.length,
    proposalsPlanned: report.proposalsPlanned.length,
    durationMs: report.durationMs
  }, "permanent loop cycle finished");

  return { loopId, status: report.status, findings: report.findings.length };
}

export async function setupPermanentLoops({ connection, logger, requestJson, postJson, repoRoot }) {
  if (!loopsEnabled()) {
    logger.info("permanent loops disabled (AUTONOMY_LOOPS_ENABLED != \"true\") — scheduler not started");
    return null;
  }

  const queue = new Queue(AUTONOMY_LOOPS_QUEUE, { connection });

  for (const definition of permanentLoops) {
    await queue.add(
      definition.id,
      { loopId: definition.id },
      {
        repeat: { pattern: definition.schedule },
        jobId: `loop-${definition.id}`,
        removeOnComplete: 20,
        removeOnFail: 20
      }
    );
    logger.info({ loopId: definition.id, schedule: definition.schedule }, "permanent loop scheduled");
  }

  const worker = new Worker(
    AUTONOMY_LOOPS_QUEUE,
    async (job) => runLoopCycleJob({ loopId: job.data.loopId, logger, requestJson, postJson, repoRoot }),
    { connection, concurrency: 1 }
  );

  worker.on("failed", (job, error) => {
    logger.error({ loopId: job?.data?.loopId, error }, "permanent loop cycle failed");
  });

  return {
    queue,
    worker,
    async close() {
      await worker.close();
      await queue.close();
    }
  };
}
