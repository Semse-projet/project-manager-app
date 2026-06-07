import { type NextRequest, NextResponse } from "next/server";
import { ensureIntakeSession, fetchPublicIntake, withIntakeSession } from "../../_shared";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { sessionToken } = ensureIntakeSession(request);

  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";
    const path = `/v1/intake/${encodeURIComponent(id)}/estimate${force ? "?force=true" : ""}`;
    const data = await fetchPublicIntake<Record<string, unknown>>(path, sessionToken, {
      method: "POST",
    });

    return withIntakeSession(NextResponse.json({ data }), sessionToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Service unavailable";
    const status = message.includes("currentScore") ? 400 : message.includes("estimate") ? 409 : 503;
    return withIntakeSession(NextResponse.json({ error: { message } }, { status }), sessionToken);
  }
}
