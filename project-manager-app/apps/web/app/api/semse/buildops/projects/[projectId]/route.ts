import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  try {
    const { projectId } = await params;
    const data = await fetchSemseDataForAuthenticatedRequest(`/v1/buildops/projects/${encodeURIComponent(projectId)}`, request);
    return NextResponse.json({ requestId: `buildops-project-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}
