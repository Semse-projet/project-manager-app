import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

type Ctx = { params: Promise<{ orgId: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    const { orgId } = await context.params;
    const data = await fetchSemseDataForRequest<Record<string, unknown>[]>(
      `/v1/organizations/${encodeURIComponent(orgId)}/labor/policies`,
      request
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest, context: Ctx) {
  try {
    const { orgId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const weekdays = Array.isArray(body.weekdays) ? body.weekdays.filter((d): d is number => typeof d === "number") : [];
    if (name.length < 2 || weekdays.length === 0 || typeof body.scheduledStartMinute !== "number" || typeof body.scheduledEndMinute !== "number") {
      return NextResponse.json({ error: { status: 400, message: "Invalid policy payload" } }, { status: 400 });
    }
    const payload: Record<string, unknown> = {
      name,
      weekdays,
      scheduledStartMinute: body.scheduledStartMinute,
      scheduledEndMinute: body.scheduledEndMinute
    };
    if (typeof body.expectedBreakMinutes === "number") payload.expectedBreakMinutes = body.expectedBreakMinutes;
    if (typeof body.overtimeAfterMinutesPerDay === "number") payload.overtimeAfterMinutesPerDay = body.overtimeAfterMinutesPerDay;
    if (typeof body.worksiteId === "string" && body.worksiteId) payload.worksiteId = body.worksiteId;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/organizations/${encodeURIComponent(orgId)}/labor/policies`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
