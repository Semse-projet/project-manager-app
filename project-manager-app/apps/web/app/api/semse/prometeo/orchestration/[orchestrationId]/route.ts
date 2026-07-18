import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../_server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orchestrationId: string }> },
) {
  try {
    const { orchestrationId } = await params;
    const data = await fetchSemseDataForRequest(
      `/v1/prometeo/orchestration/${encodeURIComponent(orchestrationId)}`,
      request,
    );
    return NextResponse.json({ data });
  } catch (e) {
    return handleServerError(e);
  }
}
