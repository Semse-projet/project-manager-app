import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

const FORWARDED = ["q", "favorite", "learned", "limit"] as const;

// Mi Diccionario — always the signed-in user's own (identity comes from the session).
export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const params = new URLSearchParams();
    for (const key of FORWARDED) {
      const value = req.nextUrl.searchParams.get(key);
      if (value) params.set(key, value);
    }
    const query = params.toString();
    const data = await fetchSemseDataForRequest(`/v1/vision/dictionary${query ? `?${query}` : ""}`, req);
    return NextResponse.json({ requestId: "web-vision-dictionary", data });
  } catch (e) { return handleServerError(e); }
}
