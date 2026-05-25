import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { userId } = await params;
    const data = await fetchSemseData(`/v1/did/${encodeURIComponent(userId)}`);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
