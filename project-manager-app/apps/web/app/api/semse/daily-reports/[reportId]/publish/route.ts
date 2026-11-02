import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

export async function POST(request: NextRequest, context: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await context.params;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(`/v1/daily-reports/${encodeURIComponent(reportId)}/publish`, request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
