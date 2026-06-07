import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../_server";

export async function GET(request: NextRequest) {
  try {
    const limit = request.nextUrl.searchParams.get("limit") ?? "20";
    const data = await fetchSemseDataForRequest(`/v1/ai-models/incidents?limit=${encodeURIComponent(limit)}`, request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await fetchSemseDataForRequest("/v1/ai-models/incidents", request, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
