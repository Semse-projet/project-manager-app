import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../../_server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ milestoneId: string; itemId: string }> },
) {
  try {
    const { milestoneId, itemId } = await context.params;
    const data = await fetchSemseDataForRequest<unknown>(
      `/v1/milestones/${milestoneId}/evidence-items/${itemId}/review`,
      request,
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ milestoneId: string; itemId: string }> },
) {
  try {
    const { milestoneId, itemId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const data = await fetchSemseDataForRequest<unknown>(
      `/v1/milestones/${milestoneId}/evidence-items/${itemId}/run-review-agent`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
