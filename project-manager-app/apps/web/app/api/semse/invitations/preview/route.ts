import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../_server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (token.length < 10) {
      return NextResponse.json({ error: { status: 400, message: "Invalid token" } }, { status: 400 });
    }
    const data = await fetchSemseDataForRequest<Record<string, unknown>>("/v1/invitations/preview", request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token })
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}
