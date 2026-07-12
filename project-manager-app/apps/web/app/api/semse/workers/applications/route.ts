import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const params = new URLSearchParams();
    const status = request.nextUrl.searchParams.get("status");
    const limit = request.nextUrl.searchParams.get("limit");
    if (status) params.set("status", status);
    if (limit) params.set("limit", limit);
    const query = params.toString();
    const data = await fetchSemseDataForRequest(`/v1/workers/applications${query ? `?${query}` : ""}`, request);
    return NextResponse.json({ requestId: "web-worker-applications", data });
  } catch (error) {
    return handleServerError(error);
  }
}
