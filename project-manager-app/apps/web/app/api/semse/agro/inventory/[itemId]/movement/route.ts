import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { itemId } = await params;
    const data = await fetchSemseDataForRequest<unknown>(`/v1/agro/inventory/items/${itemId}/movements`, req);
    return NextResponse.json({ data });
  } catch (err) {
    return handleServerError(err);
  }
}
