import { type NextRequest, NextResponse } from "next/server";
import type { JobRecordView } from "@semse/schemas";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const data = await fetchSemseDataForRequest<JobRecordView[]>("/v1/time-tracker/jobs", req);
    return NextResponse.json({ requestId: "web-time-tracker-jobs", data });
  } catch (error) {
    return handleServerError(error);
  }
}
