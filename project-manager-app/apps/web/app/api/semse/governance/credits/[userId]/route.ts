import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { userId } = await params;
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId") ?? "";
    const data = await fetchSemseData(
      `/v1/governance/credits/${encodeURIComponent(userId)}?tenantId=${encodeURIComponent(tenantId)}`,
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
