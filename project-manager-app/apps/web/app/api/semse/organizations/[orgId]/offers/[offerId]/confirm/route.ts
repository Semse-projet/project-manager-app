import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

export async function POST(request: NextRequest, context: { params: Promise<{ orgId: string; offerId: string }> }) {
  try {
    const { orgId, offerId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.legalConfirmed !== true) {
      return NextResponse.json({ error: { status: 400, message: "legalConfirmed must be true" } }, { status: 400 });
    }
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/organizations/${encodeURIComponent(orgId)}/offers/${encodeURIComponent(offerId)}/confirm`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ legalConfirmed: true }) }
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
