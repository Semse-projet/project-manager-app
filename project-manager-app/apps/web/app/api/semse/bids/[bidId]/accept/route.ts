import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bidId: string }> },
) {
  try {
    const { bidId } = await context.params;
    const data = await fetchSemseDataForRequest<unknown>(
      `/v1/bids/${bidId}/accept`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
