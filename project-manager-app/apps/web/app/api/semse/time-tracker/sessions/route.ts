import { type NextRequest, NextResponse } from "next/server";
import type { TrackerSessionView } from "@semse/schemas";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const search = new URLSearchParams();
    for (const key of ["limit", "range", "jobId", "status"]) {
      const value = req.nextUrl.searchParams.get(key);
      if (value) search.set(key, value);
    }
    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    const data = await fetchSemseDataForRequest<TrackerSessionView[]>(`/v1/time-tracker/sessions${suffix}`, req);
    return NextResponse.json({ requestId: "web-time-tracker-sessions", data });
  } catch (error) {
    return handleServerError(error);
  }
}
