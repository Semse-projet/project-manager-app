import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../_server";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const data = await fetchSemseDataForRequest<unknown>(
      `/v1/ops/algorithm-engine/replay/${encodeURIComponent(id)}`,
      request,
      { method: "POST" },
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
