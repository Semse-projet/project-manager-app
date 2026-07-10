import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const data = await fetchSemseDataForRequest(`/v1/labor/timer/${encodeURIComponent(id)}/notes`, req, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
    return NextResponse.json({ requestId: "web-labor-timer-notes", data });
  } catch (e) { return handleServerError(e); }
}
