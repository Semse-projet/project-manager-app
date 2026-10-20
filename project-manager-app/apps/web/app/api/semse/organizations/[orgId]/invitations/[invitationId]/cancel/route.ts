import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, runtimeDisabledResponse } from "../../../../../_server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orgId: string; invitationId: string }> }
) {
  try {
    const { orgId, invitationId } = await context.params;
    const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (!reason || reason.length > 500) return NextResponse.json({ error: { status: 400, message: "Cancellation reason is required (1-500 characters)" } }, { status: 400 });
    const data = await fetchSemseDataForAuthenticatedRequest<Record<string, unknown>>(
      `/v1/organizations/${encodeURIComponent(orgId)}/invitations/${encodeURIComponent(invitationId)}/cancel`,
      request,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason })
      }
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}

