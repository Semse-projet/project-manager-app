import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const data = await fetchSemseDataForRequest("/v1/labor/proximity-config", req);
    return NextResponse.json({ requestId: "web-labor-proximity-config", data });
  } catch (e) { return handleServerError(e); }
}
