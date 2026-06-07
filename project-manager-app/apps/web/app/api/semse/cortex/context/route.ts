import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!isSemseRuntimeEnabled()) {
    return NextResponse.json({
      requestId: `ctx-demo-${Date.now()}`,
      data: {
        mode: "demo",
        activeProject: null,
        notifications: [],
        payments: { pendingRelease: 0 },
        milestones: { pendingApproval: 0 },
        disputes: { open: 0 },
        systemHealth: { api: "degraded", worker: "degraded", redis: "degraded" },
      },
    });
  }

  try {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const data = await fetchSemseDataForRequest(`/v1/ai-models/operational-context${qs}`, req);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
