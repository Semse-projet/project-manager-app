import { NextRequest, NextResponse } from "next/server";
import { normalizeJobRecordStatus, type JobRecordView } from "@semse/schemas";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, runtimeDisabledResponse } from "../../_server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const data = await fetchSemseDataForAuthenticatedRequest<JobRecordView>(`/v1/jobs/${jobId}`, request);
    return NextResponse.json({ data: normalizeJobRecordStatus(data) });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}
