import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, runtimeDisabledResponse } from "../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

export async function GET(request: NextRequest) {
  try {
    const data = await fetchSemseDataForAuthenticatedRequest<Record<string, unknown>[]>("/v1/offers/mine", request);
    return NextResponse.json({ data }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}
