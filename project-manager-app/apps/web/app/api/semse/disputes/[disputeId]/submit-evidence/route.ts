import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ disputeId: string }> },
) {
  try {
    const { disputeId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/disputes/${encodeURIComponent(disputeId)}/submit-evidence`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
