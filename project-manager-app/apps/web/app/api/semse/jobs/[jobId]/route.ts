import { NextRequest, NextResponse } from "next/server";
import { type JobRecordView } from "@semse/schemas";
import { fetchSemseData, handleServerError, runtimeDisabledResponse } from "../../_server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const data = await fetchSemseData<JobRecordView>(`/v1/jobs/${jobId}`);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}
