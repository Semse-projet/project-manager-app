import { type NextRequest, NextResponse } from "next/server";
import type { TrackerBootstrapView } from "@semse/schemas";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const data = await fetchSemseDataForRequest<TrackerBootstrapView>("/v1/time-tracker", req);
    return NextResponse.json({ requestId: "web-time-tracker-snapshot", data });
  } catch (error) {
    return handleServerError(error);
  }
}
