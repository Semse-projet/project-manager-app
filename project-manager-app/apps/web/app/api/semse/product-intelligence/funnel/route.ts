import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

/** PI-05.2 — funnel de Product Intelligence para el panel admin. */
export async function GET(request: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const days = request.nextUrl.searchParams.get("days") ?? "7";
    const data = await fetchSemseDataForRequest(
      `/v1/product-intelligence/funnel?days=${encodeURIComponent(days)}`,
      request,
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
