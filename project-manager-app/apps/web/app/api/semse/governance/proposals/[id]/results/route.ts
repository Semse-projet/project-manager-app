import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { id } = await params;
    const data = await fetchSemseData(`/v1/governance/proposals/${encodeURIComponent(id)}/results`);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
