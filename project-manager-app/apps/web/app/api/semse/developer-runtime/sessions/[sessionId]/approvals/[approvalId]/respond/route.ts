import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../../../_server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string; approvalId: string }> },
) {
  try {
    const { sessionId, approvalId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const data = await fetchSemseDataForRequest(
      `/v1/developer-runtime/sessions/${encodeURIComponent(sessionId)}/approvals/${encodeURIComponent(approvalId)}/respond`,
      request,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    return NextResponse.json({ requestId: "web-developer-runtime-approval-respond", data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}
