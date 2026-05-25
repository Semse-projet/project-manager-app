import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") ?? "";
    const status = searchParams.get("status");
    const qs = status ? `tenantId=${tenantId}&status=${status}` : `tenantId=${tenantId}`;
    const data = await fetchSemseDataForRequest<unknown[]>(`/v1/governance/proposals?${qs}`, request);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}

export async function POST(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 });
  }
  try {
    const data = await fetchSemseData("/v1/governance/proposals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleServerError(error);
  }
}
