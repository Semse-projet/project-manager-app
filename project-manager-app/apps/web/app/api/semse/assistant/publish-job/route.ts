import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../_server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await fetchSemseDataForRequest("/v1/assistant/publish-job", request, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (e) {
    return handleServerError(e);
  }
}
