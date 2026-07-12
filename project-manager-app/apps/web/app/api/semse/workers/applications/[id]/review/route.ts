import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const data = await fetchSemseDataForRequest(`/v1/workers/applications/${encodeURIComponent(id)}/review`, request, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: "web-worker-application-review", data });
  } catch (error) {
    return handleServerError(error);
  }
}
