import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ alertId: string }> }) {
  if (!isSemseRuntimeEnabled()) {
    return runtimeDisabledResponse();
  }

  try {
    const { alertId } = await context.params;
    const data = await fetchSemseDataForAuthenticatedRequest(`/v1/ops/alerts/${alertId}/ack`, request, {
      method: "POST"
    });

    return NextResponse.json({ requestId: "web-ops-alert-ack", data });
  } catch (error) {
    return handleServerError(error);
  }
}
