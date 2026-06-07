import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../_server";

export async function GET(request: NextRequest) {
  try {
    const data = await fetchSemseDataForRequest("/v1/intelligence/pmo/dashboard", request);
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}
