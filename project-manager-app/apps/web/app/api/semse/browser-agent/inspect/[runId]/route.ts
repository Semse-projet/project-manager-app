import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../_server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await context.params;
    const data = await fetchSemseDataForRequest(`/v1/browser-agent/inspect/${runId}`, request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
