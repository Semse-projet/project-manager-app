import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../_server";

const INTAKE_SESSION_COOKIE = "semse_intake_session";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { sessionToken?: unknown };
    const cookieSessionToken = request.cookies.get(INTAKE_SESSION_COOKIE)?.value?.trim();
    const sessionToken =
      typeof body.sessionToken === "string" && body.sessionToken.trim().length > 0
        ? body.sessionToken.trim()
        : cookieSessionToken;

    if (!sessionToken) {
      return NextResponse.json({ error: { message: "Missing intake session token" } }, { status: 400 });
    }

    const data = await fetchSemseDataForRequest(`/v1/intake/${encodeURIComponent(id)}/claim`, request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionToken }),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
