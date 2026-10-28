import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

export async function GET(request: NextRequest, context: { params: Promise<{ crewId: string; reportDate: string }> }) {
  try {
    const { crewId, reportDate } = await context.params;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/crews/${encodeURIComponent(crewId)}/daily-reports/${encodeURIComponent(reportDate)}`,
      request
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
