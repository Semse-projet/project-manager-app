import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../_server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trade = searchParams.get("trade");
    const path  = trade
      ? `/v1/ops/algorithm-engine/runs/${encodeURIComponent(trade)}`
      : "/v1/ops/algorithm-engine/stats";
    const data = await fetchSemseDataForRequest<unknown>(path, request);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
