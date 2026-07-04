import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const data = await fetchSemseDataForRequest(`/v1/labor/timer/${encodeURIComponent(id)}/stop`, req, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: "web-labor-timer-stop", data });
  } catch (e) { return handleServerError(e); }
}
