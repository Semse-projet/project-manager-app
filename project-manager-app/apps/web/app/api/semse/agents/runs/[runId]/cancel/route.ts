import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../_server";

export async function POST(request: NextRequest, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params;
    const data = await fetchSemseDataForRequest<unknown>(
      `/v1/agents/runs/${encodeURIComponent(runId)}/cancel`,
      request,
      { method: "POST" },
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
