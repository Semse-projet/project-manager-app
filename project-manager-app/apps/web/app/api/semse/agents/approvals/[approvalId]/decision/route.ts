import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../_server";

export async function POST(request: NextRequest, context: { params: Promise<{ approvalId: string }> }) {
  try {
    const { approvalId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const data = await fetchSemseDataForRequest<unknown>(
      `/v1/agents/approvals/${encodeURIComponent(approvalId)}/decision`,
      request,
      { method: "POST", body: JSON.stringify(body) },
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
