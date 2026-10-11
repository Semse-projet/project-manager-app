import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, runtimeDisabledResponse } from "../../_server";

export async function GET(request: NextRequest) {
  try {
    const jobs = await fetchSemseDataForAuthenticatedRequest<Record<string, unknown>[]>("/v1/jobs", request);
    return NextResponse.json({
      requestId: `req-${Date.now()}`,
      data: jobs
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}
