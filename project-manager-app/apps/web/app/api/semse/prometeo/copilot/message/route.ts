import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../_server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const data = await fetchSemseDataForRequest("/v1/prometeo/copilot/message", request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (e) {
    return handleServerError(e);
  }
}
