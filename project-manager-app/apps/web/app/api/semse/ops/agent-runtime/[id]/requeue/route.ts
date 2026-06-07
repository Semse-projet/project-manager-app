import { NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSemseRuntimeEnabled()) {
    return runtimeDisabledResponse();
  }

  try {
    const { id } = await context.params;
    const data = await fetchSemseData(`/v1/ops/agent-runtime/${encodeURIComponent(id)}/requeue`, {
      method: "POST"
    });

    return NextResponse.json({ requestId: "web-ops-agent-runtime-requeue", data });
  } catch (error) {
    return handleServerError(error);
  }
}
