import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  try {
    const { taskId } = await params;
    const data = await fetchSemseDataForAuthenticatedRequest(`/v1/buildops/tasks/${encodeURIComponent(taskId)}`, request);
    return NextResponse.json({ requestId: `buildops-task-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}
