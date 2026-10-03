import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { userId } = await params;
    const data = await fetchSemseDataForAuthenticatedRequest(
      `/v1/governance/credits/${encodeURIComponent(userId)}`,
      req,
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
