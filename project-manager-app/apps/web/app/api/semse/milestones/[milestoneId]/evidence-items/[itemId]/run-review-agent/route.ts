import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../../_server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ milestoneId: string; itemId: string }> },
) {
  try {
    const { milestoneId, itemId } = await context.params;
    const data = await fetchSemseDataForRequest<unknown>(
      `/v1/milestones/${encodeURIComponent(milestoneId)}/evidence-items/${encodeURIComponent(itemId)}/run-review-agent`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
