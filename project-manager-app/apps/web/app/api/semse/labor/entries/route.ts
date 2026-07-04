import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const url = new URL(req.url);
    const qs = url.searchParams.toString();
    const data = await fetchSemseDataForRequest(`/v1/labor/entries${qs ? `?${qs}` : ""}`, req);
    return NextResponse.json({ requestId: "web-labor-entries", data });
  } catch (e) { return handleServerError(e); }
}
