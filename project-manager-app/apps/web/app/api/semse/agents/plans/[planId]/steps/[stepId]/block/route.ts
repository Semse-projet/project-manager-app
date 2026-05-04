import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../../../_server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ planId: string; stepId: string }> },
) {
  try {
    const { planId, stepId } = await context.params;
    const body = await request.text();
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/agents/plans/${encodeURIComponent(planId)}/steps/${encodeURIComponent(stepId)}/block`,
      request,
      {
        method: "PATCH",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body || undefined,
      },
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
