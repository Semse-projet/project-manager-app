import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ runbookId: string }> }) {
  if (!isSemseRuntimeEnabled()) {
    return runtimeDisabledResponse();
  }

  try {
    const { runbookId } = await context.params;
    const data = await fetchSemseDataForAuthenticatedRequest(`/v1/ops/runbooks/${runbookId}/execute`, request, {
      method: "POST"
    });

    return NextResponse.json({ requestId: "web-ops-runbook-execute", data });
  } catch (error) {
    return handleServerError(error);
  }
}
