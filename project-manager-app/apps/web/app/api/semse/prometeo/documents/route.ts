import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../_server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const data = await fetchSemseDataForRequest(`/v1/prometeo/documents${qs ? "?" + qs : ""}`, request);
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}
