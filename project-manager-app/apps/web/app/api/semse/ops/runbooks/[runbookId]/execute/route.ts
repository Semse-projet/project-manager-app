import { NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function POST(_: Request, context: { params: Promise<{ runbookId: string }> }) {
  if (!isSemseRuntimeEnabled()) {
    return runtimeDisabledResponse();
  }

  try {
    const { runbookId } = await context.params;
    const data = await fetchSemseData(`/v1/ops/runbooks/${runbookId}/execute`, {
      method: "POST"
    });

    return NextResponse.json({ requestId: "web-ops-runbook-execute", data });
  } catch (error) {
    return handleServerError(error);
  }
}
