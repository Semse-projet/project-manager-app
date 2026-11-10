import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

export async function GET(request: NextRequest) {
  try {
    const data = await fetchSemseDataForRequest<Record<string, unknown>[]>("/v1/me/skills/attestations", request);
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.consent !== true) {
      return NextResponse.json({ error: { status: 400, message: "consent must be true" } }, { status: 400 });
    }
    const payload: Record<string, unknown> = { consent: true };
    if (Array.isArray(body.trades)) {
      const trades = body.trades.filter((t): t is string => typeof t === "string" && t.trim().length >= 2);
      if (trades.length > 0) payload.trades = trades;
    }
    if (typeof body.expiresInDays === "number") payload.expiresInDays = body.expiresInDays;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>("/v1/me/skills/attestations", request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
