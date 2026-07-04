import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  const { id } = await params;
  try {
    const data = await fetchSemseDataForRequest(`/v1/labor/timer/${encodeURIComponent(id)}/resume`, req, { method: "POST" });
    return NextResponse.json({ requestId: "web-labor-timer-resume", data });
  } catch (e) { return handleServerError(e); }
}
