import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const data = await fetchSemseDataForRequest("/v1/labor/free-projects", req);
    return NextResponse.json({ requestId: "web-labor-free-projects", data });
  } catch (e) { return handleServerError(e); }
}

export async function POST(req: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const body = await req.json() as Record<string, unknown>;
    const data = await fetchSemseDataForRequest("/v1/labor/free-projects", req, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: "web-labor-free-projects-create", data }, { status: 201 });
  } catch (e) { return handleServerError(e); }
}
