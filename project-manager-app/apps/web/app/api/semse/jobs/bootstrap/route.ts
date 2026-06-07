import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, runtimeDisabledResponse } from "../../_server";

export async function GET(_request: NextRequest) {
  void _request;
  try {
    const jobs = await fetchSemseData<Record<string, unknown>[]>("/v1/jobs");
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
