import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../_server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await fetchSemseDataForRequest("/v1/browser-agent/missions", request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
