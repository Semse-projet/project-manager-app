import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ travelId: string }> }
) {
  try {
    const { travelId } = await params;
    const data = await fetchSemseDataForRequest(`/v1/travel/${encodeURIComponent(travelId)}/advances`, _request);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ travelId: string }> }
) {
  try {
    const { travelId } = await params;
    const body = await request.json();
    const data = await fetchSemseDataForRequest(`/v1/travel/${encodeURIComponent(travelId)}/advances`, request, {
      method: "POST",
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
