import { runBrowserInspection } from "./browser-agent.service.mjs";

/**
 * Handles specialized browser-agent runs dispatched from the queue.
 * 
 * @param {Object} context - Handler context from worker runner
 * @param {Object} context.run - The agent run record
 * @param {Function} context.requestJson - API fetch helper
 * @param {string} context.tenantId - Tenant scope ID
 * @param {Object} context.logger - Pino logging instance
 * @returns {Promise<{summary: string, result: Object}>} The run result
 */
export async function handleBrowserAgent({ run, requestJson, tenantId, logger }) {
  const url = run.input?.url;
  if (!url) {
    throw new Error("Browser agent execution requires a 'url' parameter in run input.");
  }

  logger.info({ runId: run.id, url }, "Starting browser agent inspection run");

  const includeScreenshot = run.input?.includeScreenshot !== false;
  const includeText = run.input?.includeText !== false;

  const result = await runBrowserInspection(url, {
    includeScreenshot,
    includeText,
  });

  const summary = result.success
    ? `BrowserAgent inspeccionó exitosamente ${url}. Estado: ${result.status.toUpperCase()} (${result.consoleErrors.length} errores de consola, ${result.networkFailures.length} fallos de red).`
    : `BrowserAgent falló al inspeccionar ${url}: ${result.error || "error desconocido"}`;

  logger.info({ runId: run.id, url, success: result.success }, "Browser agent inspection run completed");

  return {
    summary,
    result,
  };
}
