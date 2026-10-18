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
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/organizations/${encodeURIComponent(orgId)}/offers/${encodeURIComponent(offerId)}/revoke`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
