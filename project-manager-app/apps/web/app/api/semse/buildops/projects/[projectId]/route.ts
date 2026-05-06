import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  try {
    const { projectId } = await params;
    const data = await fetchSemseData(`/v1/buildops/projects/${encodeURIComponent(projectId)}`);
    return NextResponse.json({ requestId: `buildops-project-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}
