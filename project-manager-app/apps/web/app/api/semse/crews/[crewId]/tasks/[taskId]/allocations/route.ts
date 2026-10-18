import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

type Ctx = { params: Promise<{ crewId: string; taskId: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    const { crewId, taskId } = await context.params;
    const data = await fetchSemseDataForRequest<Record<string, unknown>[]>(
      `/v1/crews/${encodeURIComponent(crewId)}/tasks/${encodeURIComponent(taskId)}/allocations`,
      request
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest, context: Ctx) {
  try {
    const { crewId, taskId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const userIds = Array.isArray(body.userIds) ? body.userIds.filter((v): v is string => typeof v === "string" && v.length > 0) : [];
    if (userIds.length === 0) {
      return NextResponse.json({ error: { status: 400, message: "userIds is required" } }, { status: 400 });
    }
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : undefined;
    const data = await fetchSemseDataForRequest<Record<string, unknown>[]>(
      `/v1/crews/${encodeURIComponent(crewId)}/tasks/${encodeURIComponent(taskId)}/allocations`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userIds, ...(reason ? { reason } : {}) }) }
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
