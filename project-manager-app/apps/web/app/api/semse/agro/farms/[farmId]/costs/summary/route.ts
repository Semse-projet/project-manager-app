import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ farmId: string }> }) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { farmId } = await params;
    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since");
    const qs = since ? `?since=${encodeURIComponent(since)}` : "";
    const data = await fetchSemseDataForRequest<unknown>(`/v1/agro/farms/${farmId}/costs/summary${qs}`, req);
    return NextResponse.json({ data });
  } catch (err) {
    return handleServerError(err);
  }
}
