import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: { params: Promise<{ runId: string }> }) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const { runId } = await context.params;
    const data = await fetchSemseDataForRequest(`/v1/autonomy/runs/${encodeURIComponent(runId)}`, req);
    return NextResponse.json({ requestId: "web-autonomy-run-detail", data });
  } catch (error) {
    return handleServerError(error);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ runId: string }> }) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const { runId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const data = await fetchSemseDataForRequest(`/v1/autonomy/runs/${encodeURIComponent(runId)}/continue`, req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    return NextResponse.json({ requestId: "web-autonomy-run-continue", data });
  } catch (error) {
    return handleServerError(error);
  }
}
