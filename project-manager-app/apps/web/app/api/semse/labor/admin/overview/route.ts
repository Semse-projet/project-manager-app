import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const data = await fetchSemseDataForRequest("/v1/labor/admin/overview", req);
    return NextResponse.json({ requestId: "web-labor-admin-overview", data });
  } catch (e) { return handleServerError(e); }
}
