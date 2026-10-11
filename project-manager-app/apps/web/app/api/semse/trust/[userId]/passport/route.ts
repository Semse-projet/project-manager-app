import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { userId } = await params;
    const data = await fetchSemseDataForAuthenticatedRequest(`/v1/users/${encodeURIComponent(userId)}/trust-passport`, request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
