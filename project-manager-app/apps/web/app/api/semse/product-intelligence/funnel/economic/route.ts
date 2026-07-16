import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

/** PI-06 — funnel económico job→bid→contract→escrow→pago. */
export async function GET(request: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const days = request.nextUrl.searchParams.get("days") ?? "30";
    const data = await fetchSemseDataForRequest(
      `/v1/product-intelligence/funnel/economic?days=${encodeURIComponent(days)}`,
      request,
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
