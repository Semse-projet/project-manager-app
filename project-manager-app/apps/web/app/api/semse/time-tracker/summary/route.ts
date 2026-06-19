import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const range = req.nextUrl.searchParams.get("range");
    const suffix = range ? `?range=${encodeURIComponent(range)}` : "";
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(`/v1/time-tracker/summary${suffix}`, req);
    return NextResponse.json({ requestId: "web-time-tracker-summary", data });
  } catch (error) {
    return handleServerError(error);
  }
}
