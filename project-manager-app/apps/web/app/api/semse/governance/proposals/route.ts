import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, resolveRuntimeConfigForRequest, runtimeDisabledResponse } from "../../_server";

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
  const config = await resolveRuntimeConfigForRequest(req);
  if (!config) return runtimeDisabledResponse();

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; } catch {
    return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 });
  }
  try {
    // Inject real authorId from session — client cannot forge it
    const payload = { ...body, authorId: config.userId, tenantId: body.tenantId ?? config.tenantId };
    const data = await fetchSemseDataForRequest("/v1/governance/proposals", req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleServerError(error);
  }
}
