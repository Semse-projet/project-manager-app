import { type NextRequest, NextResponse } from "next/server";
import { ensureIntakeSession, fetchPublicIntake, withIntakeSession } from "../_shared";

export async function POST(request: NextRequest) {
  const { sessionToken } = ensureIntakeSession(request);

  try {
    const body = await request.json() as Record<string, unknown>;
    const data = await fetchPublicIntake<Record<string, unknown>>("/v1/intake/analyze", sessionToken, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, sessionToken }),
    });

    return withIntakeSession(NextResponse.json({ data }), sessionToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Service unavailable";
    return withIntakeSession(NextResponse.json({ error: { message } }, { status: 503 }), sessionToken);
  }
}

