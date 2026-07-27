import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../../_server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string; verificationType: string }> }
) {
  try {
    const { userId, verificationType } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/users/${encodeURIComponent(userId)}/verify-request/${encodeURIComponent(verificationType)}/review`,
      request,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}
