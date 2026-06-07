import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../_server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const data = await fetchSemseDataForRequest(`/v1/contractor/leads${qs ? `?${qs}` : ""}`, request);
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await fetchSemseDataForRequest("/v1/contractor/leads", request, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}
