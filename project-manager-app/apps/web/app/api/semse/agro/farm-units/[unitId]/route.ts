import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> },
) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 });
  }
  try {
    const { unitId } = await params;
    const data = await fetchSemseDataForRequest(`/v1/agro/farm-units/${encodeURIComponent(unitId)}`, req, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: `agro-unit-update-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}
