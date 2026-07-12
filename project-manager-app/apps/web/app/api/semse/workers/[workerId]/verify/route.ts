import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ workerId: string }> }) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  const { workerId } = await params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(workerId)) {
    return NextResponse.json({ error: { message: "Invalid workerId" } }, { status: 400 });
  }
  try {
    const data = await fetchSemseDataForRequest(`/v1/workers/${encodeURIComponent(workerId)}/verify`, request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    return NextResponse.json({ requestId: "web-worker-verify", data });
  } catch (error) {
    return handleServerError(error);
  }
}
