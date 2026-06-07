import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  try {
    const data = await fetchSemseData("/v1/buildops/overview");
    return NextResponse.json({ requestId: `buildops-overview-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}
