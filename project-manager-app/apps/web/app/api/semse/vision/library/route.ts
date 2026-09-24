import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

const FORWARDED = ["q", "category", "trade", "limit"] as const;

export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const params = new URLSearchParams();
    for (const key of FORWARDED) {
      const value = req.nextUrl.searchParams.get(key);
      if (value) params.set(key, value);
    }
    const data = await fetchSemseDataForRequest(`/v1/vision/library/search?${params.toString()}`, req);
    return NextResponse.json({ requestId: "web-vision-library-search", data });
  } catch (e) { return handleServerError(e); }
}
