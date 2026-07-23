import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../../../_server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  const { id } = await params;
  try {
    const data = await fetchSemseDataForRequest(`/v1/labor/admin/timer/${encodeURIComponent(id)}/pause`, req, {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    return NextResponse.json({ requestId: "web-labor-admin-timer-pause", data });
  } catch (e) { return handleServerError(e); }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  const { id } = await params;
  try {
    const data = await fetchSemseDataForRequest(`/v1/labor/admin/timer/${encodeURIComponent(id)}/pause`, req, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
    });
    return NextResponse.json({ requestId: "web-labor-admin-timer-pause", data });
  } catch (e) { return handleServerError(e); }
}
