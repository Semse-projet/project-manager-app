import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  try {
    const data = await fetchSemseDataForAuthenticatedRequest("/v1/buildops/milestones", request);
    return NextResponse.json({ requestId: `buildops-milestones-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}
