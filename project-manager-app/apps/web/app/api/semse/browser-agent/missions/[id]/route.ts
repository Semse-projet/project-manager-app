import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../_server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (typeof id !== "string" || !/^[a-zA-Z0-9_\-]+$/.test(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }
    const data = await fetchSemseDataForRequest(`/v1/browser-agent/missions/${encodeURIComponent(id)}`, request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
