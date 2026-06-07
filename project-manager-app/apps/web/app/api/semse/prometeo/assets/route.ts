import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../_server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const data = await fetchSemseDataForRequest(`/v1/prometeo/assets${qs ? "?" + qs : ""}`, request);
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const data = await fetchSemseDataForRequest("/v1/prometeo/assets", request, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}
