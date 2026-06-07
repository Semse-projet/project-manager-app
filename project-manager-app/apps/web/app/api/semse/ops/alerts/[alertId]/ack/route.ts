import { NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function POST(_: Request, context: { params: Promise<{ alertId: string }> }) {
  if (!isSemseRuntimeEnabled()) {
    return runtimeDisabledResponse();
  }

  try {
    const { alertId } = await context.params;
    const data = await fetchSemseData(`/v1/ops/alerts/${alertId}/ack`, {
      method: "POST"
    });

    return NextResponse.json({ requestId: "web-ops-alert-ack", data });
  } catch (error) {
    return handleServerError(error);
  }
}
