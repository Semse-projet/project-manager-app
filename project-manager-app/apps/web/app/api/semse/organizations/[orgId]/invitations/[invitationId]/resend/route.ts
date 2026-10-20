import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, runtimeDisabledResponse } from "../../../../../_server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orgId: string; invitationId: string }> }
) {
  try {
    const { orgId, invitationId } = await context.params;
    const data = await fetchSemseDataForAuthenticatedRequest<Record<string, unknown>>(
      `/v1/organizations/${encodeURIComponent(orgId)}/invitations/${encodeURIComponent(invitationId)}/resend`,
      request,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      }
    );
    return NextResponse.json({ data }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}

