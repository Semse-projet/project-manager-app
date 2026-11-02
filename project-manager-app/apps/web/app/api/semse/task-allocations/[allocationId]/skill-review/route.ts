import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

export async function POST(request: NextRequest, context: { params: Promise<{ allocationId: string }> }) {
  try {
    const { allocationId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.decision !== "CONFIRM" && body.decision !== "REJECT") {
      return NextResponse.json({ error: { status: 400, message: "decision must be CONFIRM or REJECT" } }, { status: 400 });
    }
    const trade = typeof body.trade === "string" ? body.trade.trim() : "";
    if (body.decision === "CONFIRM" && trade.length < 2) {
      return NextResponse.json({ error: { status: 400, message: "trade is required to confirm" } }, { status: 400 });
    }
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined;
    const payload: Record<string, unknown> = { decision: body.decision };
    if (trade) payload.trade = trade;
    if (note) payload.note = note;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/task-allocations/${encodeURIComponent(allocationId)}/skill-review`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
