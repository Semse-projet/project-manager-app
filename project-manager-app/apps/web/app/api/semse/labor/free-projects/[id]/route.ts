import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  const { id } = await params;
  try {
    const body = await req.json() as Record<string, unknown>;
    const data = await fetchSemseDataForRequest(`/v1/labor/free-projects/${encodeURIComponent(id)}`, req, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: "web-labor-free-project-update", data });
  } catch (e) { return handleServerError(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  const { id } = await params;
  try {
    const data = await fetchSemseDataForRequest(`/v1/labor/free-projects/${encodeURIComponent(id)}`, req, { method: "DELETE" });
    return NextResponse.json({ requestId: "web-labor-free-project-delete", data });
  } catch (e) { return handleServerError(e); }
}
