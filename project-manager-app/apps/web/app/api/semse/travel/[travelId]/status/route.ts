import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ travelId: string }> }
) {
  try {
    const { travelId } = await params;
    const body = await request.json();
    const data = await fetchSemseDataForRequest(`/v1/travel/${encodeURIComponent(travelId)}/status`, request, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}
