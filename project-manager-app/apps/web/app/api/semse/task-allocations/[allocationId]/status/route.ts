import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

const STATUSES = ["ACKNOWLEDGED", "IN_PROGRESS", "BLOCKED", "SUBMITTED"];

export async function POST(request: NextRequest, context: { params: Promise<{ allocationId: string }> }) {
  try {
    const { allocationId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.status !== "string" || !STATUSES.includes(body.status)) {
      return NextResponse.json({ error: { status: 400, message: "Invalid status" } }, { status: 400 });
    }
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/task-allocations/${encodeURIComponent(allocationId)}/status`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: body.status, ...(note ? { note } : {}) }) }
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
