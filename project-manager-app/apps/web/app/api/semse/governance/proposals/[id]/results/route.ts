import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { id } = await params;
    const data = await fetchSemseDataForAuthenticatedRequest(`/v1/governance/proposals/${encodeURIComponent(id)}/results`, request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
