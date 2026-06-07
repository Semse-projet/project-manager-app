import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ notificationId: string }> }
) {
  try {
    const { notificationId } = await context.params;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/notifications/${encodeURIComponent(notificationId)}/read`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}
