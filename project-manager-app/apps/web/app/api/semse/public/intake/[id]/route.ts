import { type NextRequest, NextResponse } from "next/server";
import { ensureIntakeSession, fetchPublicIntake, withIntakeSession } from "../_shared";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { sessionToken } = ensureIntakeSession(request);

  try {
    const { id } = await context.params;
    const data = await fetchPublicIntake<Record<string, unknown>>(`/v1/intake/${encodeURIComponent(id)}`, sessionToken);
    return withIntakeSession(NextResponse.json({ data }), sessionToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Service unavailable";
    return withIntakeSession(NextResponse.json({ error: { message } }, { status: 503 }), sessionToken);
  }
}
