import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

export async function POST(request: NextRequest, context: { params: Promise<{ crewId: string; taskId: string; userId: string }> }) {
  try {
    const { crewId, taskId, userId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 3) {
      return NextResponse.json({ error: { status: 400, message: "reason is required" } }, { status: 400 });
    }
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/crews/${encodeURIComponent(crewId)}/tasks/${encodeURIComponent(taskId)}/allocations/${encodeURIComponent(userId)}/release`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) }
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
