import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

export async function POST(request: NextRequest, context: { params: Promise<{ offerId: string }> }) {
  try {
    const { offerId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.decision !== "ACCEPT" && body.decision !== "DECLINE") {
      return NextResponse.json({ error: { status: 400, message: "decision must be ACCEPT or DECLINE" } }, { status: 400 });
    }
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/offers/${encodeURIComponent(offerId)}/respond`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision: body.decision }) }
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
