import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSemseRuntimeEnabled()) {
    return runtimeDisabledResponse();
  }

  try {
    const { id } = await context.params;
    const data = await fetchSemseDataForAuthenticatedRequest(`/v1/ops/agent-runtime/${encodeURIComponent(id)}/requeue`, request, {
      method: "POST"
    });

    return NextResponse.json({ requestId: "web-ops-agent-runtime-requeue", data });
  } catch (error) {
    return handleServerError(error);
  }
}
