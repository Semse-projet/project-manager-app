import { NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled } from "../_server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSemseRuntimeEnabled()) {
    return NextResponse.json({
      requestId: "web-control-surface",
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
        projects: [],
        warnings: ["Runtime SEMSE deshabilitado en el servidor web."]
      }
    });
  }

  try {
    const [dashboard, runs, projectsResult] = await Promise.all([
      fetchSemseData("/v1/ops/dashboard"),
      fetchSemseData("/v1/agents/runs"),
      fetchSemseData("/v1/projects").catch((error) => error)
    ]);

    const warnings = projectsResult instanceof Error ? [projectsResult.message] : [];

    const data = {
      dashboard,
      runs,
      projects: projectsResult instanceof Error ? [] : projectsResult,
      warnings
    };

    return NextResponse.json({
      requestId: "web-control-surface",
      data
    });
  } catch (error) {
    return handleServerError(error);
  }
}
