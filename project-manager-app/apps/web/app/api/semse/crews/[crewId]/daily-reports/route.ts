import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

type Ctx = { params: Promise<{ crewId: string }> };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest, context: Ctx) {
  try {
    const { crewId } = await context.params;
    const data = await fetchSemseDataForRequest<Record<string, unknown>[]>(`/v1/crews/${encodeURIComponent(crewId)}/daily-reports`, request);
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest, context: Ctx) {
  try {
    const { crewId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const reportDate = typeof body.reportDate === "string" ? body.reportDate : "";
    if (!DATE.test(reportDate)) {
      return NextResponse.json({ error: { status: 400, message: "reportDate must be YYYY-MM-DD" } }, { status: 400 });
    }
    const payload: Record<string, unknown> = { reportDate };
    if (typeof body.tzOffsetMinutes === "number") payload.tzOffsetMinutes = body.tzOffsetMinutes;
    if (typeof body.notes === "string" && body.notes.trim()) payload.notes = body.notes.trim();
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(`/v1/crews/${encodeURIComponent(crewId)}/daily-reports`, request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
