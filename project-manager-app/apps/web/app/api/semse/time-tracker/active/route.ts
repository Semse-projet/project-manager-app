import { type NextRequest, NextResponse } from "next/server";
import type { TrackerSessionView } from "@semse/schemas";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const data = await fetchSemseDataForRequest<TrackerSessionView | null>("/v1/time-tracker/active", req);
    return NextResponse.json({ requestId: "web-time-tracker-active", data });
  } catch (error) {
    return handleServerError(error);
  }
}
