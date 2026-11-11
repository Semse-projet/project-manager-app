import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

export async function POST(request: NextRequest, context: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.decision !== "APPROVE" && body.decision !== "RETURN") {
      return NextResponse.json({ error: { status: 400, message: "decision must be APPROVE or RETURN" } }, { status: 400 });
    }
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(`/v1/daily-reports/${encodeURIComponent(reportId)}/review`, request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: body.decision, ...(note ? { note } : {}) })
    });
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
