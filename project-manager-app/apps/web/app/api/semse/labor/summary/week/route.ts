import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const url = new URL(req.url);
    const offset = url.searchParams.get("offset") ?? "0";
    const data = await fetchSemseDataForRequest(`/v1/labor/summary/week?offset=${offset}`, req);
    return NextResponse.json({ requestId: "web-labor-summary-week", data });
  } catch (e) { return handleServerError(e); }
}
