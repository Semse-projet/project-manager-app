import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../_server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await context.params;
    if (typeof runId !== "string" || !/^[a-zA-Z0-9_\-]+$/.test(runId)) {
      return NextResponse.json({ error: "Invalid runId format" }, { status: 400 });
    }
    const data = await fetchSemseDataForRequest(`/v1/browser-agent/inspect/${encodeURIComponent(runId)}`, request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
