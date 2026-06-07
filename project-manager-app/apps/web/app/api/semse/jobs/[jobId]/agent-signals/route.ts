import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, runtimeDisabledResponse } from "../../../_server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const data = await fetchSemseData<{ signals: unknown[] }>(`/v1/jobs/${jobId}/agent-signals`);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}
