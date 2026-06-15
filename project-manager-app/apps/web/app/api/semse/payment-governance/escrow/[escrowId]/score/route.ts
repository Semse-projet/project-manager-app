import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../_server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ escrowId: string }> },
) {
  try {
    const { escrowId } = await context.params;
    const data = await fetchSemseDataForRequest<unknown>(
      `/v1/payments/escrow/${encodeURIComponent(escrowId)}/score`,
      request,
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
