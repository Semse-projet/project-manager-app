import { type NextRequest, NextResponse } from "next/server";
import type { TrackerSessionView } from "@semse/schemas";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const limit = req.nextUrl.searchParams.get("limit");
    const suffix = limit ? `?limit=${encodeURIComponent(limit)}` : "";
    const data = await fetchSemseDataForRequest<TrackerSessionView[]>(`/v1/time-tracker/sessions${suffix}`, req);
    return NextResponse.json({ requestId: "web-time-tracker-sessions", data });
  } catch (error) {
    return handleServerError(error);
  }
}
