import { NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  try {
    const data = await fetchSemseData("/v1/buildops/milestones");
    return NextResponse.json({ requestId: `buildops-milestones-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}
