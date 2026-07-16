import { runBrowserInspection } from "./browser-agent.service.mjs";
import { BrowserToolRunner, BrowserSessionPool } from "@semse/autonomy";

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
  const missionId = run.input?.missionId;

  if (missionId) {
    logger.info({ runId: run.id, missionId }, "Starting stateful browser mission execution");

    // 1. Fetch mission details
    const missionRes = await requestJson(`/v1/browser-agent/missions/${missionId}`);
    const mission = missionRes.data;

    // Update mission status to RUNNING
    await requestJson(`/v1/browser-agent/missions/${missionId}`, {
      method: "PATCH",
      body: { status: "RUNNING" }
    });

    const sessionId = `session-${missionId}`;
    let lastResult = null;

    try {
      for (const step of mission.steps) {
        logger.info({ missionId, stepId: step.id, action: step.actionType }, "Executing mission step");
        
        await requestJson(`/v1/browser-agent/missions/${missionId}/steps/${step.id}`, {
          method: "PATCH",
          body: { status: "RUNNING" }
        });

        let stepResult;
        switch (step.actionType) {
          case "navigate":
            stepResult = await BrowserToolRunner.navigate(sessionId, step.parameters.url);
            break;
          case "get_markdown":
            stepResult = await BrowserToolRunner.getMarkdown(sessionId);
            break;
          case "query":
            stepResult = await BrowserToolRunner.query(sessionId, step.parameters.selector);
            break;
          case "click":
            stepResult = await BrowserToolRunner.click(sessionId, step.parameters.selector);
            break;
          case "fill":
            stepResult = await BrowserToolRunner.fill(sessionId, step.parameters.selector, step.parameters.value);
            break;
          default:
            throw new Error(`Unsupported action type: ${step.actionType}`);
        }

        if (stepResult.success) {
          await requestJson(`/v1/browser-agent/missions/${missionId}/steps/${step.id}`, {
            method: "PATCH",
            body: { status: "COMPLETED", evidenceRef: stepResult.finalUrl || null }
          });
          lastResult = stepResult;
        } else {
          throw new Error(stepResult.error || "Step failed");
        }
      }

      await requestJson(`/v1/browser-agent/missions/${missionId}`, {
        method: "PATCH",
        body: { status: "COMPLETED" }
      });

      // Cleanup session on success
      await BrowserSessionPool.closeSession(sessionId);

      return {
        summary: `Misión ${missionId} completada exitosamente.`,
        result: { success: true, lastResult }
      };

    } catch (error) {
      logger.error({ missionId, error: error.message }, "Mission execution failed");
      await requestJson(`/v1/browser-agent/missions/${missionId}`, {
        method: "PATCH",
        body: { status: "FAILED" }
      });
      
      // Cleanup session on error
      await BrowserSessionPool.closeSession(sessionId);

      return {
        summary: `Misión ${missionId} falló: ${error.message}`,
        result: { success: false, error: error.message }
      };
    }
  }

  // Fallback to legacy single URL inspection
  const url = run.input?.url;
  if (!url) {
    throw new Error("Browser agent execution requires a 'url' or 'missionId' parameter in run input.");
  }

  logger.info({ runId: run.id, url }, "Starting browser agent inspection run");

  const includeScreenshot = run.input?.includeScreenshot !== false;
  const includeText = run.input?.includeText !== false;

  const result = await runBrowserInspection(url, {
    includeScreenshot,
    includeText,
    tenantId,
    projectId: run.input?.projectId,
    milestoneId: run.input?.milestoneId,
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
