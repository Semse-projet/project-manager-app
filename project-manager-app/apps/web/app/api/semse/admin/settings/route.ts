import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const data = await fetchSemseDataForRequest<Record<string, unknown>>("/v1/admin/settings", request);
    return NextResponse.json({ requestId: "web-admin-settings-get", data });
  } catch (error) {
    return handleServerError(error);
  }
}

export async function PUT(request: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>("/v1/admin/settings", request, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: "web-admin-settings-put", data });
  } catch (error) {
    return handleServerError(error);
  }
}
