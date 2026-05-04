import { type NextRequest, NextResponse } from "next/server";
import type { TrackerSnapshotView } from "@semse/schemas";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const data = await fetchSemseDataForRequest<TrackerSnapshotView>("/v1/field-ops/tracker", req);
    return NextResponse.json({ requestId: "web-tracker-snapshot", data });
  } catch (error) {
    return handleServerError(error);
  }
}
