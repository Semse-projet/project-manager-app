import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, isSemseRuntimeEnabled } from "../_server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isSemseRuntimeEnabled()) {
    return NextResponse.json({
      requestId: "web-cortex",
      data: {
        dashboard: {
          jobs: {
            total: 0,
            published: 0,
            awarded: 0,
            posted: 0,
            reserved: 0,
            accepted: 0,
            inProgress: 0,
            review: 0,
            dispute: 0,
            completed: 0,
            cancelled: 0
          },
          projects: {
            total: 0,
            open: 0,
            inProgress: 0,
            blocked: 0,
            completed: 0,
            cancelled: 0
          },
          disputes: {
            total: 0,
            open: 0,
            assigned: 0,
            resolved: 0
          },
          agents: {
            totalRuns: 0,
            queued: 0,
            running: 0,
            failed: 0,
            deadLettered: 0,
            maxAttemptsReached: 0
          }
        },
        runs: [],
        riskScores: [],
        audit: [],
        agentRuntime: {
          total: 0,
          filters: { limit: 12 },
          items: []
        },
        warnings: ["Runtime SEMSE deshabilitado en el servidor web."]
      }
    });
  }

  try {
    const [dashboard, runs, riskScoresResult, auditResult, agentRuntimeResult] = await Promise.all([
      fetchSemseDataForAuthenticatedRequest("/v1/ops/dashboard", request),
      fetchSemseDataForAuthenticatedRequest("/v1/agents/runs", request),
      fetchSemseDataForAuthenticatedRequest("/v1/ops/risk-scores", request).catch((error) => error),
      fetchSemseDataForAuthenticatedRequest("/v1/ops/audit", request).catch((error) => error),
      fetchSemseDataForAuthenticatedRequest("/v1/ops/agent-runtime?limit=12", request).catch((error) => error)
    ]);

    const warnings: string[] = [];
    if (riskScoresResult instanceof Error) {
      warnings.push(riskScoresResult.message);
    }
    if (auditResult instanceof Error) {
      warnings.push(auditResult.message);
    }
    if (agentRuntimeResult instanceof Error) {
      warnings.push(agentRuntimeResult.message);
    }

    const data = {
      dashboard,
      runs,
      riskScores: riskScoresResult instanceof Error ? [] : riskScoresResult,
      audit: auditResult instanceof Error ? [] : auditResult,
      agentRuntime: agentRuntimeResult instanceof Error
        ? { total: 0, filters: { limit: 12 }, items: [] }
        : agentRuntimeResult,
      warnings
    };

    return NextResponse.json({
      requestId: "web-cortex",
      data
    });
  } catch (error) {
    return handleServerError(error);
  }
}
