import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
    const data = await fetchSemseDataForAuthenticatedRequest<unknown[]>(`/v1/governance/proposals${suffix}`, request);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; } catch {
    return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 });
  }
  try {
    const payload = { ...body };
    delete payload.authorId;
    delete payload.tenantId;
    const data = await fetchSemseDataForAuthenticatedRequest("/v1/governance/proposals", req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleServerError(error);
  }
}
