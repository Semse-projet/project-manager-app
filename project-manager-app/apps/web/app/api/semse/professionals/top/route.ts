import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../_server";

export async function GET(request: NextRequest) {
  try {
    const data = await fetchSemseDataForRequest(
      "/v1/intelligence/credentials/top?limit=6",
      request,
    );
    return NextResponse.json({ data });
  } catch (e) {
    // Graceful fallback — landing must never break if backend is down
    return NextResponse.json({
      data: [],
      _fallback: true,
    });
  }
}
