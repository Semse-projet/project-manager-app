import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const timeEntryId = typeof body.timeEntryId === "string" ? body.timeEntryId.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!timeEntryId || reason.length < 5) {
      return NextResponse.json({ error: { status: 400, message: "timeEntryId and reason are required" } }, { status: 400 });
    }
    const payload: Record<string, unknown> = { timeEntryId, reason };
    if (typeof body.startedAt === "string" && body.startedAt) payload.startedAt = body.startedAt;
    if (typeof body.endedAt === "string" && body.endedAt) payload.endedAt = body.endedAt;
    if (typeof body.breakMinutes === "number") payload.breakMinutes = body.breakMinutes;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>("/v1/labor/corrections", request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
