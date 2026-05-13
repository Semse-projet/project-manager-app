import { type NextRequest, NextResponse } from "next/server";
import { ensureIntakeSession, fetchPublicIntake, withIntakeSession } from "../../_shared";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { sessionToken } = ensureIntakeSession(request);

  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const data = await fetchPublicIntake<Record<string, unknown>>(`/v1/intake/${encodeURIComponent(id)}/answer`, sessionToken, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, sessionToken }),
    });

    return withIntakeSession(NextResponse.json({ data }), sessionToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Service unavailable";
    return withIntakeSession(NextResponse.json({ error: { message } }, { status: 503 }), sessionToken);
  }
}
